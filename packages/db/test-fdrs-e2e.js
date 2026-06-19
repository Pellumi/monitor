const crypto = require('crypto');

async function runTest() {
  const appId = 'acadai-local';
  console.log(`Starting FDRS End-to-End Integration Test for Application: ${appId}`);

  // 1. Create a declared flow
  console.log('\n--- Step 1: Creating Declared Flow ---');
  const flowRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'AcadAI Student Journey', workflowType: 'LMS' })
  });
  if (!flowRes.ok) throw new Error(`Failed to create flow: ${await flowRes.text()}`);
  const flow = await flowRes.json();
  const flowId = flow.id;
  console.log(`Created Flow ID: ${flowId}, Version: ${flow.version}`);

  // 2. Add State 'LOGIN'
  console.log('\n--- Step 2: Adding LOGIN State ---');
  const loginStateRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateName: 'LOGIN', category: 'BUSINESS', provenance: 'USER_AUTHORED' })
  });
  const { state: loginState, suggestions } = await loginStateRes.json();
  console.log(`Added State: ${loginState.stateName} (ID: ${loginState.id})`);
  console.log(`Suggestions generated: ${suggestions.length}`);

  // Find LOGIN_FAILURE suggestion and accept it
  const failureSug = suggestions.find(s => s.suggestedStateName === 'LOGIN_FAILURE');
  let failureStateId;
  if (failureSug) {
    console.log(`\n--- Step 3: Accepting Suggestion for LOGIN_FAILURE (Pattern: ${failureSug.patternId}) ---`);
    const acceptRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/suggestions/${failureSug.id}/accept`, {
      method: 'POST'
    });
    const acceptData = await acceptRes.json();
    failureStateId = acceptData.state.id;
    console.log(`Successfully accepted suggestion. Created State: ${acceptData.state.stateName} (ID: ${failureStateId}) with provenance: ${acceptData.state.provenance}`);
  } else {
    console.log('LOGIN_FAILURE suggestion not found, adding manually.');
    const failRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/states`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateName: 'LOGIN_FAILURE', category: 'ERROR', provenance: 'USER_AUTHORED' })
    });
    const failData = await failRes.json();
    failureStateId = failData.state.id;
  }

  // 4. Add State 'COURSE_ENROLLED'
  console.log('\n--- Step 4: Adding COURSE_ENROLLED State ---');
  const courseStateRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateName: 'COURSE_ENROLLED', category: 'BUSINESS', provenance: 'USER_AUTHORED' })
  });
  const { state: courseState } = await courseStateRes.json();
  console.log(`Added State: ${courseState.stateName} (ID: ${courseState.id})`);

  // 5. Add State 'QUIZ_SUBMITTED'
  console.log('\n--- Step 5: Adding QUIZ_SUBMITTED State ---');
  const quizStateRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateName: 'QUIZ_SUBMITTED', category: 'BUSINESS', provenance: 'USER_AUTHORED' })
  });
  const { state: quizState } = await quizStateRes.json();
  console.log(`Added State: ${quizState.stateName} (ID: ${quizState.id})`);

  // 6. Add transitions
  console.log('\n--- Step 6: Adding Transitions ---');
  // LOGIN -> COURSE_ENROLLED
  const trans1Res = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromStateId: loginState.id, toStateId: courseState.id, action: 'enroll', provenance: 'USER_AUTHORED' })
  });
  const trans1 = await trans1Res.json();
  console.log(`Added Transition: ${trans1.fromState.stateName} -> ${trans1.toState.stateName}`);

  // COURSE_ENROLLED -> QUIZ_SUBMITTED
  const trans2Res = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromStateId: courseState.id, toStateId: quizState.id, action: 'submit_quiz', provenance: 'USER_AUTHORED' })
  });
  const trans2 = await trans2Res.json();
  console.log(`Added Transition: ${trans2.fromState.stateName} -> ${trans2.toState.stateName}`);

  // LOGIN -> LOGIN_FAILURE
  const trans3Res = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromStateId: loginState.id, toStateId: failureStateId, action: 'fail', provenance: 'USER_AUTHORED' })
  });
  const trans3 = await trans3Res.json();
  console.log(`Added Transition: ${trans3.fromState.stateName} -> ${trans3.toState.stateName}`);

  // 7. Complete Declared Flow
  console.log('\n--- Step 7: Completing Flow and Compiling Ruleset ---');
  const completeRes = await fetch(`http://localhost:3008/applications/${appId}/declared-flow/${flowId}/complete`, {
    method: 'POST'
  });
  const completeFlow = await completeRes.json();
  console.log(`Flow marked COMPLETE. Status: ${completeFlow.status}`);

  // 8. Emit Simulated Session Telemetry Events to Event Collector
  console.log('\n--- Step 8: Emitting Telemetry Events ---');
  const sessionId = crypto.randomUUID();
  const timestamp = Date.now();

  const createEvent = (type, metadata, offset = 0) => ({
    eventId: crypto.randomUUID(),
    sessionId,
    tenantId: 'dev-tenant',
    applicationId: appId,
    eventType: type,
    eventVersion: '1.0',
    source: 'web',
    timestamp: new Date(timestamp + offset).toISOString(),
    metadata
  });

  const events = [
    // 1. Visit Home (Anonymous state)
    createEvent('PAGE_VIEW', { url: '/' }, 0),
    // 2 Perform Login (Observed LOGIN state)
    createEvent('PAGE_VIEW', { url: '/login' }, 1000),
    // 2b. Fail Login (Observed LOGIN_FAILURE state)
    createEvent('BUSINESS_EVENT', { businessEventType: 'LOGIN_FAILURE' }, 1500),
    // 2c. Back to Login (Observed LOGIN state)
    createEvent('PAGE_VIEW', { url: '/login' }, 1800),
    // 3. Enroll Course (Observed COURSE_ENROLLED state)
    createEvent('PAGE_VIEW', { url: '/course/enroll' }, 2500),
    // 4. Submit Quiz (Observed QUIZ_SUBMITTED state)
    createEvent('PAGE_VIEW', { url: '/quiz/submit' }, 3500),
    // 5. Visit dashboard (Extracts STUDENT_DASHBOARD, which is undeclared)
    createEvent('PAGE_VIEW', { url: '/student/dashboard' }, 4500)
  ];

  const emitRes = await fetch(`http://localhost:3001/v1/events/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(events)
  });
  console.log(`Event Collector response status: ${emitRes.status}`);

  // 9. Wait for Graph Engine to process events and trigger reconciliation
  console.log('\nWaiting 4 seconds for asynchronous processing and auto-reconciliation...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  // 10. Fetch and verify the Reconciliation Report
  console.log('\n--- Step 9: Fetching Reconciliation Report ---');
  const recRes = await fetch(`http://localhost:3008/applications/${appId}/reconciliation`);
  const reports = await recRes.json();
  const activeReport = reports.find(r => r.flowId === flowId);

  if (!activeReport) {
    console.error('Reconciliation report not generated for the new flow!');
    return;
  }

  console.log('\n=== RECONCILIATION SUMMARY ===');
  console.log(`Report ID: ${activeReport.id}`);
  console.log(`Generated At: ${activeReport.generatedAt}`);
  
  console.log(`\nStates:`);
  console.log(` - Confirmed States count: ${activeReport.confirmedCount}`);
  console.log(` - True Gaps (Declared but not observed): ${activeReport.trueGapCount}`);
  console.log(` - Undeclared States (Observed but not declared): ${activeReport.undeclaredCount}`);
  console.log(` - Expected State Coverage Score: ${(activeReport.expectedCoverageScore * 100).toFixed(1)}%`);

  console.log(`\nTransitions:`);
  console.log(` - Confirmed Transitions: ${activeReport.confirmedTransitions}`);
  console.log(` - True Gap Transitions: ${activeReport.trueGapTransitions}`);
  console.log(` - Undeclared Transitions: ${activeReport.undeclaredTransitions}`);
  console.log(` - Transition Coverage Score: ${(activeReport.transitionCoverageScore * 100).toFixed(1)}%`);

  console.log(`\nDetailed Lists:`);
  console.log(`True Gaps (States):`, JSON.stringify(activeReport.trueGaps, null, 2));
  console.log(`Undeclared (States):`, JSON.stringify(activeReport.undeclared, null, 2));
  console.log(`True Gap Transitions:`, JSON.stringify(activeReport.trueGapTransitionsList, null, 2));
  console.log(`Undeclared Transitions:`, JSON.stringify(activeReport.undeclaredTransitionsList, null, 2));

  console.log('\nE2E Integration Test completed successfully!');
}

runTest().catch(console.error);
