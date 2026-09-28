// The renderer bundles ES modules only, and @tellann/desktop-contracts is CommonJS, so nothing at runtime can be
// imported from it here (types can). The few pure functions the start form needs live in one dependency-free file
// of that package, tested there and used by the main process, and are read from source.
export * from '../../../../packages/desktop-contracts/src/automation-setup';
