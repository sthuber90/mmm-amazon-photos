module.exports = {
  moduleFileExtensions: ['js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['setupJest.js'],
  setupFilesAfterEnv: ['<rootDir>/setupJest.js'],
  collectCoverageFrom: ['mmm-amazon-photos.js', 'node_helper.js'],
}
