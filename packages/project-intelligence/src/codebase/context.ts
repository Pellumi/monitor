import type ts from 'typescript';
import type { CodeEvidence } from '@tellann/desktop-contracts';
import type { GraphBuilder } from './core';
import type { PackageBoundary } from './inventory';

/**
 * Everything an analyzer needs while walking one source file. Shared so the
 * semantic extractor and the framework adapters can run inside a single AST
 * traversal instead of each re-walking the tree.
 */
export type FileContext = {
  graph: GraphBuilder;
  checker: ts.TypeChecker;
  program: ts.Program;
  source: ts.SourceFile;
  /** Repository-relative, forward-slashed path of the file being walked. */
  file: string;
  fileId: string;
  packageRoot: string;
  packageId: string;
  packageOf: (file: string) => string;
  /** Package boundary that owns this file, when one was discovered. */
  boundary: PackageBoundary | undefined;
  /** All package boundaries, for dependency and workspace resolution. */
  boundaries: PackageBoundary[];
  /** Innermost declaration entity id, or the file id at top level. */
  scope: () => string;
  /** Entity id for a repository-relative path, if that file is in the graph. */
  entityForFile: (file: string) => string | undefined;
  /** Resolves a module specifier to a repository-relative path, when internal. */
  resolveModule: (specifier: string, from: ts.SourceFile) => string | null;
  /** Maps a resolved declaration node to its entity id, when one was recorded. */
  entityForDeclaration: (declaration: ts.Node) => string | undefined;
  evidence: (node: ts.Node, kind: string, analyzer: string, confidence: number) => CodeEvidence;
  /** True when this file is a test file, from the inventory classification. */
  isTest: boolean;
  environmentKeys: Set<string>;
};

export type FrameworkAdapter = (context: FileContext, node: ts.Node) => void;
