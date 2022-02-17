/* global Module */

/* mmm-amazon-photos.js
 *
 * Magic Mirror
 * Module: mmm-amazon-photos
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module mmm-amazon-photos by Stephan Huber
 * MIT Licensed.
 */

Module.register('mmm-amazon-photos', {
  // Default module config.
  defaults: {
    // if set to true adds a click handler to the gradient to toggle other module visibility.
    // works only together with the gradient
    focus: true,
    // an array of strings, each is a path to a directory with images
    imageUrls: ['https://www.amazon.com/clouddrive/share/placeholderShareId'],
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 60 * 60 * 1000,
    // the sizing of the background image
    // cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges
    // contain: Resize the background image to make sure the image is fully visible
    backgroundSize: 'cover', // cover or contain
    // if backgroundSize contain, determine where to zoom the picture. Towards top, center or bottom
    backgroundPosition: 'center', // Most useful options: "top" or "center" or "bottom"
    // the gradient to make the text more visible
    gradient: [
      'rgba(0, 0, 0, 0.75) 0%',
      'rgba(0, 0, 0, 0) 40%',
      'rgba(0, 0, 0, 0) 80%',
      'rgba(0, 0, 0, 0.75) 100%',
    ],
    // the direction the gradient goes, vertical, horizontal or both for a vignette effect
    gradientDirection: 'vertical',
  },

  // load function
  start: function () {
    // add identifier to the config
    this.config.identifier = this.identifier
  },

  getScripts: function () {
    return []
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return [this.file('mmm-amazon-photos.css')]
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    if (sender) {
      if (notification === 'AMAZONPHOTOS_IMAGE_UPDATE') {
        Log.log('mmm-amazon-photos: Changing Background')
        this.suspend()
        this.updateImage()
        this.resume()
      } else if (notification === 'AMAZONPHOTOS_PLAY') {
        // Change to next image and start timer.
        this.updateImage()
        this.resume()
      } else if (notification === 'AMAZONPHOTOS_PAUSE') {
        // Stop timer.
        this.suspend()
      } else if (notification === 'AMAZONPHOTOS_URL') {
        if (payload && payload.url) {
          // Stop timer.
          if (payload.resume) {
            if (this.timer) {
              // Restart timer only if timer was already running
              this.resume()
            }
          } else {
            this.suspend()
          }
          this.updateImage(payload.url)
          // no urls sent, see if there is saved data.
        } else if (this.savedImage) {
          this.image = this.savedImage
          this.savedImage = null
          this.updateImage()
          if (this.timer) {
            // Restart timer only if timer was already running
            this.resume()
          }
        }
      }
    }
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    // if an update was received
    if (notification === 'AMAZONPHOTOS_FILELIST') {
      // check this is for this module based on the id
      if (payload.identifier === this.identifier) {
        // set the image list
        if (this.savedImage) {
          this.savedImage = payload.image
        } else {
          this.image = payload.image
          // if image list actually contains images
          // set loaded flag to true and update dom
          if (typeof this.image !== 'undefined' && this.image !== '') {
            this.updateImage() //Added to show the image at least once, but do not change it within this.resume()
            this.resume()
          }
        }
      }
    }
  },

  // Override dom generator.
  getDom: function () {
    const wrapper = document.createElement('div')
    this.imagesDiv = document.createElement('div')
    this.imagesDiv.className = 'images'
    wrapper.appendChild(this.imagesDiv)

    if (
      this.config.gradientDirection === 'vertical' ||
      this.config.gradientDirection === 'both'
    ) {
      const gradientBottom = this.createGradientDiv(
        'bottom',
        this.config.gradient
      )
      wrapper.appendChild(gradientBottom)
    }

    if (
      this.config.gradientDirection === 'horizontal' ||
      this.config.gradientDirection === 'both'
    ) {
      const gradientRight = this.createGradientDiv(
        'right',
        this.config.gradient
      )
      wrapper.appendChild(gradientRight)
    }

    if (this.config.imageUrls.length === 0) {
      Log.error('mmm-amazon-photos: Missing required parameter imageUrls.')
    } else {
      // create an empty image list
      this.image = ''
      this.retrieveImage()
    }

    return wrapper
  },

  createGradientDiv: function (direction, gradient) {
    const div = document.createElement('div')
    div.style.backgroundImage =
      'linear-gradient( to ' + direction + ', ' + gradient.join() + ')'
    div.className = 'gradient'
    this.config.focus
      ? div.addEventListener('click', function () {
          Array.from(document.getElementsByClassName('container')).forEach(
            function (elem) {
              if (
                !elem.innerHTML.includes('mmm-amazon-photos') &&
                elem.innerHTML !== ''
              ) {
                if (elem.style.display === 'none') {
                  elem.style.display = 'block'
                } else {
                  elem.style.display = 'none'
                }
              }
            }
          )
        })
      : undefined
    return div
  },

  createDiv: function () {
    const div = document.createElement('div')
    div.style.backgroundSize = this.config.backgroundSize
    div.style.backgroundPosition = this.config.backgroundPosition
    div.className = 'image'
    return div
  },

  updateImage: function (imageToDisplay = null) {
    if (!imageToDisplay) {
      if (!this.image || this.image === '') {
        return
      }
    }

    const image = new Image()

    if (imageToDisplay) {
      image.src = encodeURI(imageToDisplay)
    } else {
      image.src = encodeURI(this.image)
    }

    const that = this
    image.onload = function () {
      // check if there are more than 2 elements and remove the first one
      if (that.imagesDiv.childNodes.length > 1) {
        that.imagesDiv.removeChild(that.imagesDiv.childNodes[0])
      }
      if (that.imagesDiv.childNodes.length > 0) {
        that.imagesDiv.childNodes[0].style.opacity = '0'
      }

      const imageDiv = that.createDiv()
      imageDiv.style.backgroundImage = `url("${image.src}")`
      that.imagesDiv.appendChild(imageDiv)
    }
  },

  suspend: function () {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  resume: function () {
    this.suspend()
    const self = this
    this.timer = setInterval(function () {
      Log.info(`${self.name}: updating from resume`)
      self.retrieveImage()
    }, self.config.slideshowSpeed)
  },

  retrieveImage: function () {
    this.suspend()
    Log.info('mmm-amazon-photos: Getting Image')
    // ask helper function to get the image list
    this.sendSocketNotification('AMAZONPHOTOS_REGISTER_CONFIG', this.config)
  },
})
