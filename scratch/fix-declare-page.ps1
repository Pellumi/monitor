# Read the file
$content = Get-Content "c:\Users\pellu\dev\monitor\apps\dashboard\src\app\declare\page.tsx" -Raw

# The corrupted section starts at line 1137 and goes to line 1164
# We need to replace lines 1137-1164 with proper code

# Split into lines
$lines = $content -split "`r?`n"

# Build the replacement block
$replacement = @'
    return () => clearInterval(interval);
  }, [aiDraftJobId, appId]);

  // Aggregate pending suggestions from all states in the flow
  const pendingSuggestions = useMemo(() => {
    if (!activeFlow) return [];
    const sugs: DeclaredStateSuggestion[] = [];
    for (const state of activeFlow.states) {
      if (state.suggestions) {
        for (const sug of state.suggestions) {
          if (
            sug.status === "PENDING" ||
            sug.status === "SUGGESTED" ||
            sug.status === "EDITED"
          ) {
            sugs.push(sug);
          }
        }
      }
    }
    return sugs.sort((a, b) => b.confidence - a.confidence);
  }, [activeFlow]);

  // If onboarding is active, render the onboarding wizard stages
  if (onboardingProgress && !onboardingProgress.completedAt) {
    // Gap 8: Show AI draft job loading indicator while polling
    if (aiDraftJobId) {
      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-lg space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="h-8 w-8 text-amber-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Generating AI Draft
            </h2>
            <p className="text-sm text-neutral-400">
              Our AI is analyzing your application description and generating a
              comprehensive flow draft. This typically takes 10-30 seconds.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-xs text-neutral-600 font-mono">
              Job ID: {aiDraftJobId.slice(0, 8)}...
            </p>
          </div>
        </div>
      );
    }

    // Gap 8: Show AI draft job error with fallback option
    if (aiDraftJobError) {
      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-lg space-y-6 rounded-2xl border border-red-900/40 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <span className="text-3xl">&#x26A0;&#xFE0F;</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              AI Draft Generation Failed
            </h2>
            <p className="text-sm text-red-300">{aiDraftJobError}</p>
            <p className="text-sm text-neutral-400">
              You can continue setting up your flows manually, or try generating the draft again.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setAiDraftJobError(null);
                  queryClient.invalidateQueries({ queryKey: ["onboarding-progress", appId] });
                }}
                className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
              >
                Continue Manually
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiDraftJobError(null);
                  selectProfileMutation.mutate({
                    profileType: "PROMPT_AI_EXPERIMENTAL",
                    description: profileDescription.trim(),
                  });
                }}
                disabled={!profileDescription.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Retry AI Draft
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Stage 1: Select profile template
    if (!onboardingProgress.templateSelected) {
      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
                Select Application Profile
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Choose a workflow template to preload standard states and
                transitions, or start from scratch.
              </p>
            </div>

            {selectProfileMutation.isError && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-300">
                {selectProfileMutation.error instanceof Error
                  ? selectProfileMutation.error.message
                  : "Profile selection failed. Try again."}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROFILE_TEMPLATES.map((template) => {
                const IconComponent = template.icon;
                return (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() =>
                      selectProfileMutation.mutate({
                        profileType: template.id,
                        description: profileDescription.trim() || undefined,
                      })
                    }
                    disabled={selectProfileMutation.isPending}
                    className="flex flex-col items-center p-6 bg-neutral-950/40 hover:bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 rounded-xl text-center transition-all duration-200 group disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="p-3 bg-neutral-900 group-hover:bg-blue-500/10 rounded-lg text-neutral-400 group-hover:text-blue-400 transition-colors mb-4">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors mb-2">
                      {template.name}
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {template.desc}
                    </p>
                  </button>
                );
              })}
            </div>
'@

# Lines are 0-indexed in the array, so lines 1137-1164 are indices 1136-1163
# Replace lines 1137 through 1164 (inclusive)
$before = $lines[0..1135]  # Lines 1-1136
$after = $lines[1164..($lines.Length - 1)]  # Lines 1165+

$newContent = ($before -join "`r`n") + "`r`n" + $replacement + "`r`n" + ($after -join "`r`n")

[System.IO.File]::WriteAllText("c:\Users\pellu\dev\monitor\apps\dashboard\src\app\declare\page.tsx", $newContent)

Write-Host "File updated successfully"
