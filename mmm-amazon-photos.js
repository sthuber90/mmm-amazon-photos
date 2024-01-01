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
    // if true randomize image order
    randomizeImageOrder: false,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: 'bmp,jpg,jpeg,gif,png',
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
    // show a panel containing information about the image currently displayed.
    showImageInfo: true,
  },

  // load function
  start: function () {
    // add identifier to the config
    this.config.identifier = this.identifier
    // ensure file extensions are lower case
    this.config.validImageFileExtensions =
      this.config.validImageFileExtensions.toLowerCase()
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
      Log.debug(
        this.name +
          ' received a module notification: ' +
          notification +
          ' from sender: ' +
          sender.name
      )
      // if (notification === 'AMAZONPHOTOS_IMAGE_UPDATE') {
      //   Log.debug('mmm-amazon-photos: Changing Background');
      //   this.suspend();
      //   this.updateImage();
      //   this.resume();
      // } else {
      //   // Log.debug(this.name + " received a system notification: " + notification);
      // }
    }
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    // if an update was received
    if (notification === 'AMAZONPHOTOS_FILELIST') {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
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

  toggleModulesAndImageInfo: function (imageInfoDiv, focus, showImageInfo) {
    const modules = Array.from(document.getElementsByClassName('module'))
    const gradients = Array.from(document.getElementsByClassName('gradient'))
    const areModulesVisible = !(
      modules
        .filter((m) => ![...m.classList].includes('mmm-amazon-photos'))
        .reduce((prev, curr) => prev?.style?.display || curr?.style.display) ===
      'none'
    )
    // case 1: click -> hide modules and gradient
    if (focus && areModulesVisible) {
      console.log('A')
      modules.forEach(function (elem) {
        if (![...elem.classList].includes('mmm-amazon-photos')) {
          elem.style.display = 'none'
        }
      })

      if (gradients && gradients.length == 1) {
        const gradient = gradients[0]
        gradient.style.display = 'none'
      }
    }
    // case 2: click -> show gradient, hide modules and show image info
    else if (showImageInfo && imageInfoDiv.style.display !== 'inline-grid') {
      console.log('B')
      modules.forEach(function (elem) {
        if (
          ![...elem.classList].includes('mmm-amazon-photos') &&
          elem.style.display === 'block'
        ) {
          elem.style.display = 'none'
        }
      })

      if (gradients && gradients.length == 1) {
        const gradient = gradients[0]
        gradient.style.display = 'block'
      }

      imageInfoDiv.style.display = 'inline-grid'
    }
    // case 3: click -> show modules, show gradient, hide image info
    else {
      console.log('C')
      modules.forEach(function (elem) {
        elem.style.display = 'block'
      })

      if (gradients && gradients.length == 1) {
        const gradient = gradients[0]
        gradient.style.display = 'block'
      }

      imageInfoDiv.style.display = 'none'
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

    this.imageInfoDiv = this.createImageInfoDiv(wrapper)

    if (this.config.imageUrl.length == 0) {
      // Log.error('mmm-amazon-photos: Missing required parameter imageUrl.');
    } else {
      // create image source and load cached image if it exists
      this.imageSource = `${location.origin}/modules/mmm-amazon-photos/images/photo.jpg`
      this.updateImageList()
    }

    this.config.focus
      ? window.addEventListener('click', () => {
          this.toggleModulesAndImageInfo(
            this.imageInfoDiv,
            this.config.focus,
            this.config.showImageInfo
          )
        }) &
        window.addEventListener('touchstart', () => {
          this.toggleModulesAndImageInfo(
            this.imageInfoDiv,
            this.config.focus,
            this.config.showImageInfo
          )
        })
      : undefined

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
    div.className = 'info'
    div.style.display = 'none'
    wrapper.appendChild(div)
    return div
  },

  updateImage: function () {
    const getFraction = (exposureTime) => {
      if (exposureTime) {
        return `1/${Math.floor(1 / exposureTime)}`
      }

      return null
    }

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

      EXIF.getData(image, async () => {
        // only used for debugging exif data
        // const allMetaData = EXIF.getAllTags(this)
        // Log.log(JSON.stringify(allMetaData, null, '\t'))
        const model = EXIF.getTag(this, 'Model')
        const aperture = EXIF.getTag(this, 'FNumber')
        const focalLength = EXIF.getTag(this, 'FocalLength')
        const iso = EXIF.getTag(this, 'ISOSpeedRatings')
        const exposureTime = getFraction(EXIF.getTag(this, 'ExposureTime'))
        // array in degree-minutes-seconds format
        const lat = EXIF.getTag(this, 'GPSLatitude')
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef')
        // array in degree-minutes-seconds format
        const lon = EXIF.getTag(this, 'GPSLongitude')
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef')
        let innerHTML = ''

        // icons from https://www.svgrepo.com. Alternatively, from https://icons8.com
        if (model) {
          const modelIcon =
            '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M3 16.8V9.2C3 8.0799 3 7.51984 3.21799 7.09202C3.40973 6.71569 3.71569 6.40973 4.09202 6.21799C4.51984 6 5.0799 6 6.2 6H7.25464C7.37758 6 7.43905 6 7.49576 5.9935C7.79166 5.95961 8.05705 5.79559 8.21969 5.54609C8.25086 5.49827 8.27836 5.44328 8.33333 5.33333C8.44329 5.11342 8.49827 5.00346 8.56062 4.90782C8.8859 4.40882 9.41668 4.08078 10.0085 4.01299C10.1219 4 10.2448 4 10.4907 4H13.5093C13.7552 4 13.8781 4 13.9915 4.01299C14.5833 4.08078 15.1141 4.40882 15.4394 4.90782C15.5017 5.00345 15.5567 5.11345 15.6667 5.33333C15.7216 5.44329 15.7491 5.49827 15.7803 5.54609C15.943 5.79559 16.2083 5.95961 16.5042 5.9935C16.561 6 16.6224 6 16.7454 6H17.8C18.9201 6 19.4802 6 19.908 6.21799C20.2843 6.40973 20.5903 6.71569 20.782 7.09202C21 7.51984 21 8.0799 21 9.2V16.8C21 17.9201 21 18.4802 20.782 18.908C20.5903 19.2843 20.2843 19.5903 19.908 19.782C19.4802 20 18.9201 20 17.8 20H6.2C5.0799 20 4.51984 20 4.09202 19.782C3.71569 19.5903 3.40973 19.2843 3.21799 18.908C3 18.4802 3 17.9201 3 16.8Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>'
          innerHTML += `<i class="icon">${modelIcon}</i>${model}`
        }
        if (aperture) {
          const apertureIcon =
            '<svg fill="#ffffff" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>aperture</title> <path d="M16 0.75c-8.422 0-15.25 6.828-15.25 15.25s6.828 15.25 15.25 15.25c8.422 0 15.25-6.828 15.25-15.25v0c-0.010-8.418-6.832-15.24-15.249-15.25h-0.001zM27.101 9.75h-11.823l3.562-6.17c3.567 0.841 6.496 3.087 8.228 6.108l0.033 0.062zM20.331 15.999l-2.166 3.751h-4.33l-2.165-3.75 2.165-3.75h4.345zM16 3.25c0.047 0 0.093 0.007 0.14 0.007l-5.913 10.242-3.557-6.16c2.327-2.516 5.645-4.087 9.33-4.089h0zM5.040 9.518l5.907 10.232h-7.133c-0.358-1.118-0.565-2.405-0.565-3.74 0-2.397 0.666-4.638 1.822-6.549l-0.032 0.057zM4.899 22.25h11.823l-3.563 6.17c-3.566-0.841-6.496-3.087-8.227-6.107l-0.033-0.062zM16 28.75c-0.047 0-0.093-0.007-0.14-0.007l5.91-10.238 3.544 6.174c-2.326 2.506-5.637 4.069-9.314 4.071h-0zM26.948 22.502l-5.886-10.252h7.124c0.358 1.118 0.564 2.405 0.564 3.74 0 2.405-0.67 4.654-1.834 6.569l0.032-0.056z"></path> </g></svg>'
          innerHTML += `<i class="icon"> ${apertureIcon}</i><span>ƒ ${aperture}</span>`
        }
        if (focalLength) {
          const focalLengthIcon =
            '<svg fill="#ffffff" viewBox="0 0 14 14" role="img" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="m 10.455539,12.321608 c -0.9090603,-0.534 -1.7662403,-0.7779 -2.2964903,-0.6533 -0.61351,0.1441 -0.89286,0.02 -1.01638,-0.4503 -0.0937,-0.357 -1.38552,-1.2907005 -2.87074,-2.0749005 -3.63357003,-1.9185 -3.63102003,-2.4873 0.0192,-4.2935 1.60612,-0.7947 2.71959,-1.5719 2.71959,-1.8983 0,-0.3775 0.31608,-0.5313 0.99718,-0.4853 0.54845,0.037 1.5683,-0.2861 2.2663303,-0.7181 1.58251,-0.97939998 2.17567,-0.99529998 2.17567,-0.058 0,0.4996 -0.48634,0.9661 -1.5411,1.4785 l -1.5411003,0.7486 0.0447,3.126 0.0448,3.1261005 1.4963503,0.7247 c 0.90434,0.438 1.49635,0.975 1.49635,1.3572 0,0.979 -0.42293,0.994 -1.99437,0.071 z M 8.2860887,8.1836075 c 0.13484,-0.6139 0.14064,-1.6733 0.0129,-2.3542 l -0.23225,-1.2379 -2.15977,1.0902 c -1.18787,0.5996 -2.15977,1.2173 -2.15977,1.3727 0,0.2584 3.48649,2.1721 4.05058,2.2233 0.13373,0.012 0.35347,-0.4802 0.4883,-1.0941 z"></path></g></svg>'
          innerHTML += `<i class="icon">${focalLengthIcon}</i>${focalLength} mm`
        }
        if (exposureTime) {
          const exposureIcon =
            '<svg fill="#ffffff" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M11,7H10V6A1,1,0,0,0,8,6V7H7A1,1,0,0,0,7,9H8v1a1,1,0,0,0,2,0V9h1a1,1,0,0,0,0-2Zm2,11h4a1,1,0,0,0,0-2H13a1,1,0,0,0,0,2ZM19,2H5A3,3,0,0,0,2,5V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V5A3,3,0,0,0,19,2ZM4,18.59V5A1,1,0,0,1,5,4H18.59ZM20,19a1,1,0,0,1-1,1H5.41L20,5.41Z"></path></g></svg>'
          innerHTML += `<i class="icon">${exposureIcon}</i>${exposureTime} s`
        }
        if (iso) {
          const isoIcon =
            '<svg fill="#ffffff" viewBox="0 0 32 32" id="icon" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><defs><style>.cls-1{fill:none;}</style></defs><title>ISO--outline</title><path d="M24,21H21a2,2,0,0,1-2-2V13a2,2,0,0,1,2-2h3a2,2,0,0,1,2,2v6A2,2,0,0,1,24,21Zm-3-8v6h3V13Z"></path><path d="M15,21H10V19h5V17H12a2,2,0,0,1-2-2V13a2,2,0,0,1,2-2h5v2H12v2h3a2,2,0,0,1,2,2v2A2,2,0,0,1,15,21Z"></path><rect x="6" y="11" width="2" height="10"></rect><path d="M28,6H4A2,2,0,0,0,2,8V24a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM4,24V8H28V24Z"></path><rect id="_Transparent_Rectangle_" data-name="<Transparent Rectangle>" class="cls-1" width="32" height="32"></rect></g></svg>'
          innerHTML += `<i class="icon">${isoIcon}</i>${iso}`
        }
        if (lat && latRef && lon && lonRef) {
          const geoIcon =
            '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M10 11.5C11.933 11.5 13.5 9.933 13.5 8C13.5 6.067 11.933 4.5 10 4.5C8.067 4.5 6.5 6.067 6.5 8C6.5 9.933 8.067 11.5 10 11.5ZM10 6.5C10.8284 6.5 11.5 7.17157 11.5 8C11.5 8.82843 10.8284 9.5 10 9.5C9.17157 9.5 8.5 8.82843 8.5 8C8.5 7.17157 9.17157 6.5 10 6.5Z" fill="#ffffff"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M2.5 8.12313C2.5 12.3656 6.88183 19.5 10 19.5C13.1182 19.5 17.5 12.3656 17.5 8.12313C17.5 3.91715 14.1464 0.5 10 0.5C5.85362 0.5 2.5 3.91715 2.5 8.12313ZM15.5 8.12313C15.5 11.4027 11.7551 17.5 10 17.5C8.24487 17.5 4.5 11.4027 4.5 8.12313C4.5 5.0134 6.96668 2.5 10 2.5C13.0333 2.5 15.5 5.0134 15.5 8.12313Z" fill="#ffffff"></path> </g></svg>'
          const latitude = (lat[2] / 60 + lat[1]) / 60 + lat[0]
          const longitude = (lon[2] / 60 + lon[1]) / 60 + lon[0]

          const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${
            latRef === 'N' ? '' : '-'
          }${latitude}&lon=${
            lonRef === 'E' ? '' : '-'
          }${longitude}&format=geojson`

          try {
            const res = await fetch(geoApiUrl, {
              // abort the fetch after 3 seconds. This can maybe be replaced through using a better Geo API service in the future
              signal: AbortSignal.timeout(that.slideshowSpeed / 2),
            })
            const body = await res.json()
            // show location as address, with street, state, city, country
            innerHTML += `<i class="icon">${geoIcon}</i>${body.features[0]?.properties?.display_name}`
          } catch (ex) {
            Log.error(ex)
            // show location as WGS-84 coordinates
            innerHTML += `<i class="icon">${geoIcon}</i>${latRef}${lat}, ${lonRef}${lon}`
          }
        }

        that.imageInfoDiv.innerHTML = innerHTML
      })

      containerDiv.appendChild(imageDiv)
      that.imagesDiv.appendChild(containerDiv)
    }
    image.src = encodeURI(this.imageSource)

    this.sendNotification('AMAZONPHOTOS_IMAGE_UPDATED', { url: image.src })
    Log.debug('Updating image, source:' + image.src)
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
      Log.debug('mmm-amazon-photos updating from resume')
      self.updateImageList()
    }, self.config.slideshowSpeed)
  },

  updateImageList: function () {
    this.suspend()
    Log.debug('Getting Images')
    // ask helper function to get the image list
    this.sendSocketNotification('AMAZONPHOTOS_REGISTER_CONFIG', this.config)
  },
})
