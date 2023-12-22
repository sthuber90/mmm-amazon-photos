/* global Module */

/* mmm-amazon-photos.js
 *
 * Magic Mirror
 * Module: mmm-amazon-photos
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-Slideshow By Darick Carpenter https://github.com/darickc/MMM-BackgroundSlideshow/tree/master
 * MIT Licensed.
 */

Module.register('mmm-amazon-photos', {
  // Default module config.
  defaults: {
    // if set to true adds a click handler to the gradient to toggle other module visibility.
    // works only together with the gradient
    focus: true,
    // an array of strings, each is a path to a directory with images
    imageUrl: ['modules/mmm-amazon-photos/exampleImages'],
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 10 * 1000,
    // if true randomize image order, otherwise use sortImagesBy and sortImagesDescending
    randomizeImageOrder: false,
    // how to sort images: name, random, created, modified
    sortImagesBy: 'created',
    // whether to sort in ascending (default) or descending order
    sortImagesDescending: false,
    // if false each path with be viewed separately in the order listed
    recursiveSubDirectories: false,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: 'bmp,jpg,jpeg,gif,png',
    // show a panel containing information about the image currently displayed.
    showImageInfo: true,
    // a comma separated list of values to display: name, date, geo (TODO)
    imageInfo: 'name, date, imagecount',
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
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
    horizontalGradient: [
      'rgba(0, 0, 0, 0.75) 0%',
      'rgba(0, 0, 0, 0) 20%',
      'rgba(0, 0, 0, 0) 50%',
      'rgba(0, 0, 0, 0.75) 100%',
    ],
    // the direction the gradient goes, vertical or horizontal
    gradientDirection: 'vertical',
  },

  // load function
  start: function () {
    // add identifier to the config
    this.config.identifier = this.identifier
    // ensure file extensions are lower case
    this.config.validImageFileExtensions =
      this.config.validImageFileExtensions.toLowerCase()
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase()

    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b/gi
    if (
      this.config.showImageInfo &&
      !imageInfoRegex.test(this.config.imageInfo)
    ) {
      Log.warn(
        'mmm-amazon-photos: showImageInfo is set, but imageInfo does not have a valid value.'
      )
      // Use name as the default
      this.config.imageInfo = ['name']
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      this.config.imageInfo = this.config.imageInfo
        .toLowerCase()
        .replace(/\s/g, ',')
        .split(',')
      // now filter the array to only those that have values
      this.config.imageInfo = this.config.imageInfo.filter(function (n) {
        return n
      })
    }

    // Chrome versions < 81 do not support EXIF orientation natively. A CSS transformation
    // needs to be applied for the image to display correctly - see http://crbug.com/158753 .
    // this.browserSupportsExifOrientationNatively = CSS.supports('image-orientation: from-image');
  },

  getScripts: function () {
    return [this.file('node_modules/exif-js/exif.js'), 'moment.js']
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return ['mmm-amazon-photos.css']
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    if (sender) {
      Log.log(
        this.name +
          ' received a module notification: ' +
          notification +
          ' from sender: ' +
          sender.name
      )
      // if (notification === 'AMAZONPHOTOS_IMAGE_UPDATE') {
      //   Log.log('mmm-amazon-photos: Changing Background');
      //   this.suspend();
      //   this.updateImage();
      //   this.resume();
      // } else {
      //   // Log.log(this.name + " received a system notification: " + notification);
      // }
    }
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    // if an update was received
    // Log.log(`${notification}, ${JSON.stringify(payload)}`)
    if (notification === 'AMAZONPHOTOS_FILELIST') {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
        // console.info('Returning Images, payload:' + JSON.stringify(payload));
        // set the image list
        if (this.savedImages) {
          this.savedImages = payload.imageSource
          this.savedIndex = 0
        } else {
          this.imageSource = payload.imageSource
          // if image list actually contains images
          // set loaded flag to true and update dom
          if (this.imageSource) {
            this.updateImage() //Added to show the image at least once, but not change it within this.resume()
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
      this.createGradientDiv('bottom', this.config.gradient, wrapper)
    }

    if (
      this.config.gradientDirection === 'horizontal' ||
      this.config.gradientDirection === 'both'
    ) {
      this.createGradientDiv('right', this.config.gradient, wrapper)
    }

    if (this.config.showImageInfo) {
      this.imageInfoDiv = this.createImageInfoDiv(wrapper)
    }

    if (this.config.imageUrl.length == 0) {
      // Log.error('mmm-amazon-photos: Missing required parameter imageUrl.');
    } else {
      // create image source and load cached image if it exists
      this.imageSource = `${location.origin}/modules/mmm-amazon-photos/images/photo.jpg`
      // set beginning image index to 0, as it will auto increment on start
      // this.imageIndex = 0;
      this.updateImageList()
    }

    this.config.focus
      ? window.addEventListener('click', function () {
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

    // const that = this
    // this.config.focus
    //   ? window.addEventListener('dblclick', function () {
    //       that.imageInfoDiv.style.display = 'block'
    //     })
    //   : undefined
    return wrapper
  },

  createGradientDiv: function (direction, gradient, wrapper) {
    const div = document.createElement('div')
    div.style.backgroundImage =
      'linear-gradient( to ' + direction + ', ' + gradient.join() + ')'
    div.className = 'gradient'
    wrapper.appendChild(div)
  },

  createDiv: function () {
    const div = document.createElement('div')
    div.style.backgroundSize = this.config.backgroundSize
    div.style.backgroundPosition = this.config.backgroundPosition
    div.className = 'image'
    return div
  },

  createImageInfoDiv: function (wrapper) {
    const div = document.createElement('div')
    div.className = 'info ' + this.config.imageInfoLocation
    wrapper.appendChild(div)
    return div
  },

  updateImage: function () {
    // // get greatest common denominator
    // const gcd = (a, b) => {
    //   // Since there is a limited precision we need to limit the value.
    //   if (b < 0.0000001) return a

    //   // Discard any fractions due to limitations in precision.
    //   return gcd(b, Math.floor(a % b))
    // }
    // const getFraction = (exposureTime) => {
    //   if (exposureTime) {
    //     var len = exposureTime.toString().length - 2

    //     var denominator = Math.pow(10, len)
    //     var numerator = exposureTime * denominator

    //     var divisor = gcd(numerator, denominator)

    //     numerator /= divisor
    //     denominator /= divisor

    //     return `${Math.floor(numerator)}/${Math.floor(denominator)}`
    //   }

    //   return null
    // }

    const image = new Image()
    const that = this
    image.onload = function () {
      // remove old image divs
      that.imagesDiv.childNodes.forEach((_, idx) =>
        that.imagesDiv.removeChild(that.imagesDiv.childNodes[idx])
      )
      const containerDiv = document.createElement('div')

      const imageDiv = that.createDiv()
      imageDiv.style.backgroundImage = `url("${image.src}")`

      EXIF.getData(image, () => {
        // // const allMetaData = EXIF.getAllTags(this)
        // // console.log(JSON.stringify(allMetaData, null, '\t'))
        // const model = EXIF.getTag(this, 'Model')
        // const aperture = EXIF.getTag(this, 'FNumber')
        // const focalLength = EXIF.getTag(this, 'FocalLength')
        // const exposureTime = getFraction(EXIF.getTag(this, 'ExposureTime'))
        // let lat = EXIF.getTag(this, "GPSLatitude");
        //   let lon = EXIF.getTag(this, "GPSLongitude");
        //     this.updateImageInfo(decodeURI(image.src), dateTime);
      })

      containerDiv.appendChild(imageDiv)
      that.imagesDiv.appendChild(containerDiv)
    }
    console.info(`this.imageSource ${this.imageSource}`)
    image.src = encodeURI(this.imageSource)
    // this.imageIndex += 1;

    this.sendNotification('AMAZONPHOTOS_IMAGE_UPDATED', { url: image.src })
    console.info('Updating image, source:' + image.src)
  },

  updateImageInfo: function (imageSrc, imageDate) {
    let imageProps = []
    // Only display last path component as image name if recurseSubDirectories is not set.
    let imageName = imageSrc.split('/').pop()
    this.config.imageInfo.forEach(function (prop) {
      switch (prop) {
        case 'date':
          if (imageDate && imageDate != 'Invalid date') {
            imageProps.push(imageDate)
          }
          break

        case 'name': // default is name
          // Otherwise display path relative to the path in configuration.
          if (this.config.recursiveSubDirectories) {
            for (const path of this.config.imageUrl) {
              if (!imageSrc.includes(path)) {
                continue
              }

              imageName = imageSrc.split(path).pop()
              if (imageName.startsWith('/')) {
                imageName = imageName.substr(1)
              }
              break
            }
          }
          imageProps.push(imageName)
          break
        // case 'imagecount':
        //   imageProps.push(`${this.imageIndex} of ${this.imageList.length}`);
        //   break;
        default:
          Log.warn(
            prop +
              ' is not a valid value for imageInfo.  Please check your configuration'
          )
      }
    })

    let innerHTML = '<header class="infoDivHeader">Picture Info</header>'
    imageProps.forEach(function (val) {
      innerHTML += val + '<br/>'
    })

    this.imageInfoDiv.innerHTML = innerHTML
  },

  suspend: function () {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  resume: function () {
    //this.updateImage(); //Removed to prevent image change whenever MMM-Carousel changes slides
    this.suspend()
    const self = this
    this.timer = setInterval(function () {
      console.info('mmm-amazon-photos updating from resume')
      self.updateImageList()
    }, self.config.slideshowSpeed)
  },

  updateImageList: function () {
    this.suspend()
    console.info('Getting Images')
    // ask helper function to get the image list
    this.sendSocketNotification('AMAZONPHOTOS_REGISTER_CONFIG', this.config)
  },
})
