describe('node_helper', () => {
  let helper

  beforeEach(() => {
    helper = require('../node_helper')

    helper.setName('mmm-amazon-photos')
  })

  it('start prints module name', () => {
    helper.start()

    expect(console.log).toHaveBeenCalledWith(
      'Starting module helper: mmm-amazon-photos'
    )
  })
})
