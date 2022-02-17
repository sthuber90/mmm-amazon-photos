describe('mmm-amazon-photos', () => {
  beforeAll(() => {
    require('../__mocks__/Logger')
    require('../__mocks__/Module')
  })

  const name = 'mmm-amazon-photos'

  let MMMAmazonPhotos

  beforeEach(() => {
    jest.resetModules()
    require('../mmm-amazon-photos')

    MMMAmazonPhotos = global.Module.create(name)
    MMMAmazonPhotos.setData({ name, identifier: `Module_1_${name}` })
  })

  it('should have correct defaults', () => {
    expect(MMMAmazonPhotos.defaults).toMatchSnapshot()
  })

  it('should start', () => {
    MMMAmazonPhotos.start()
    expect(MMMAmazonPhotos.config.identifier).toEqual(
      'Module_1_mmm-amazon-photos'
    )
  })

  it('should get styles', () => {
    expect(MMMAmazonPhotos.getStyles()).toEqual(['mmm-amazon-photos.css'])
  })

  it('should get scripts', () => {
    expect(MMMAmazonPhotos.getScripts()).toEqual([])
  })

  it('should update image on notification received', () => {
    MMMAmazonPhotos.config.slideshowSpeed = 0
    MMMAmazonPhotos.notificationReceived(
      'AMAZONPHOTOS_IMAGE_UPDATE',
      '',
      'sender'
    )
    expect(global.Log.log).toHaveBeenNthCalledWith(
      1,
      'mmm-amazon-photos: Changing Background'
    )
  })

  it('should get DOM', () => {
    expect(MMMAmazonPhotos.getDom()).toMatchSnapshot()
  })

  it('should get DOM', () => {
    expect(MMMAmazonPhotos.getDom()).toMatchSnapshot()
  })

  it('should create gradient div', () => {
    const getElementsByClassNameSpy = jest.spyOn(
      document,
      'getElementsByClassName'
    )
    const innerDiv = document.createElement('div')
    getElementsByClassNameSpy.mockReturnValue([innerDiv])

    const div = MMMAmazonPhotos.createGradientDiv('bottom', [])
    expect(div).toMatchSnapshot()

    div.click()
    expect(innerDiv.style.display).toEqual('')

    innerDiv.innerHTML = 'foobar'
    div.click()
    expect(innerDiv.style.display).toEqual('none')

    div.click()
    expect(innerDiv.style.display).toEqual('block')
  })

  it('should create gradient div without click listener', () => {
    MMMAmazonPhotos.config.focus = false
    const getElementsByClassNameSpy = jest.spyOn(
      document,
      'getElementsByClassName'
    )
    const innerDiv = document.createElement('div')
    getElementsByClassNameSpy.mockReturnValue([innerDiv])

    const div = MMMAmazonPhotos.createGradientDiv('bottom', [])
    expect(div).toMatchSnapshot()

    div.click()
    expect(innerDiv.style.display).toEqual('')
  })

  it('should create div', () => {
    expect(MMMAmazonPhotos.createDiv()).toMatchSnapshot()
  })

  it('should update image and return undefined', () => {
    MMMAmazonPhotos.image = null
    expect(MMMAmazonPhotos.updateImage('a')).toBeUndefined()

    MMMAmazonPhotos.image = ''
    expect(MMMAmazonPhotos.updateImage('')).toBeUndefined()
  })

  it('should not supsend nor clear interval', () => {
    const clearIntervalSpy = jest.spyOn(global.window, 'clearInterval')
    MMMAmazonPhotos.suspend()
    expect(MMMAmazonPhotos.timer).toBeUndefined()
    expect(clearIntervalSpy).not.toHaveBeenCalled()
  })

  it('should supsend and clear interval', () => {
    const clearIntervalSpy = jest.spyOn(global.window, 'clearInterval')
    MMMAmazonPhotos.timer = 123
    MMMAmazonPhotos.suspend()
    expect(MMMAmazonPhotos.timer).toBeNull()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('should resume', () => {
    MMMAmazonPhotos.config.slideshowSpeed = 0
    jest.useFakeTimers()
    MMMAmazonPhotos.resume()
    jest.advanceTimersByTime(1000)
    expect(global.Log.info).toHaveBeenNthCalledWith(
      1,
      'mmm-amazon-photos: updating from resume'
    )
  })

  it('should retrieve image', () => {
    MMMAmazonPhotos.retrieveImage()
    expect(global.Log.info).toHaveBeenNthCalledWith(
      1,
      'mmm-amazon-photos: Getting Image'
    )
    expect(MMMAmazonPhotos.sendSocketNotification).toHaveBeenNthCalledWith(
      1,
      'AMAZONPHOTOS_REGISTER_CONFIG',
      {
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        focus: true,
        gradient: [
          'rgba(0, 0, 0, 0.75) 0%',
          'rgba(0, 0, 0, 0) 40%',
          'rgba(0, 0, 0, 0) 80%',
          'rgba(0, 0, 0, 0.75) 100%',
        ],
        gradientDirection: 'vertical',
        imageUrls: [
          'https://www.amazon.com/clouddrive/share/placeholderShareId',
        ],
        slideshowSpeed: 3600000,
      }
    )
  })
})
