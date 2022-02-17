const { mockConsole, restoreConsole } = require('./__mocks__/console')

beforeAll(mockConsole)

afterEach(() => {
  jest.clearAllTimers()
  jest.clearAllMocks()
})

afterAll(restoreConsole)
