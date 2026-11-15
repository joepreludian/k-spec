/**
 * Ports the application layer depends on. Implemented in `infrastructure/`.
 *
 * @typedef {object} BoardRepository
 * @property {() => Promise<object>} load   resolves the single Board
 * @property {(board: object) => Promise<void>} save
 *
 * @typedef {object} Clock
 * @property {() => string} now   ISO-8601 timestamp
 *
 * @typedef {object} IdGenerator
 * @property {() => string} next
 *
 * @typedef {object} Deps
 * @property {BoardRepository} repository
 * @property {Clock} clock
 * @property {IdGenerator} idGenerator
 */
export {};
