/* global Module */

/* mmm-amazon-photos.js
 *
 * Magic Mirror
 * Module: mmm-amazon-photos
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-Slideshow By Darick Carpenter
 * MIT Licensed.
 */

Module.register('mmm-amazon-photos', {
  // Default module config.
  defaults: {
    // if set to true adds a click handler to the gradient to toggle other module visibility.
    // works only together with the gradient
    focus: true,
    // an array of strings, each is a path to a directory with images
    imagePaths: ['modules/mmm-amazon-photos/exampleImages'],
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
    showImageInfo: false,
    // a comma separated list of values to display: name, date, geo (TODO)
    imageInfo: 'name, date, imagecount',
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // transition speed from one image to the other, transitionImages must be true
    transitionSpeed: '2s',
    // show a progress bar indicating how long till the next image is displayed.
    showProgressBar: false,
    // the sizing of the background image
    // cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges
    // contain: Resize the background image to make sure the image is fully visible
    backgroundSize: 'cover', // cover or contain
    // if backgroundSize contain, determine where to zoom the picture. Towards top, center or bottom
    backgroundPosition: 'center', // Most useful options: "top" or "center" or "bottom"
    // transition from one image to the other (may be a bit choppy on slower devices, or if the images are too big)
    transitionImages: false,
    // the gradient to make the text more visible
    gradient: ['rgba(0, 0, 0, 0.75) 0%', 'rgba(0, 0, 0, 0) 40%', 'rgba(0, 0, 0, 0) 80%', 'rgba(0, 0, 0, 0.75) 100%'],
    horizontalGradient: ['rgba(0, 0, 0, 0.75) 0%', 'rgba(0, 0, 0, 0) 20%', 'rgba(0, 0, 0, 0) 50%', 'rgba(0, 0, 0, 0.75) 100%'],
    // the direction the gradient goes, vertical or horizontal
    gradientDirection: 'vertical',
    // Whether to scroll larger pictures rather than cut them off
    backgroundAnimationEnabled: false,
    // How long the scrolling animation should take - if this is more than slideshowSpeed, then images do not scroll fully.
    // If it is too fast, then the image may apear gittery. For best result, by default we match this to slideshowSpeed.
    // For now, it is not documented and will default to match slideshowSpeed.
    backgroundAnimationDuration: '1s',
    // How many times to loop the scrolling back and forth.  If the value is set to anything other than infinite, the
    // scrolling will stop at some point since we reuse the same div1.
    // For now, it is not documentd and is defaulted to infinite.
    backgroundAnimationLoopCount: 'infinite',
    // Transitions to use
    transitions: [
      'opacity',
      'slideFromRight',
      'slideFromLeft',
      'slideFromTop',
      'slideFromBottom',
      'slideFromTopLeft',
      'slideFromTopRight',
      'slideFromBottomLeft',
      'slideFromBottomRight',
      'flipX',
      'flipY',
    ],
    transitionTimingFunction: 'cubic-bezier(.17,.67,.35,.96)',
    animations: ['slide', 'zoomOut', 'zoomIn'],
  },

  // load function
  start: function () {
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();

    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b/gi;
    if (this.config.showImageInfo && !imageInfoRegex.test(this.config.imageInfo)) {
      Log.warn('mmm-amazon-photos: showImageInfo is set, but imageInfo does not have a valid value.');
      // Use name as the default
      this.config.imageInfo = ['name'];
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      this.config.imageInfo = this.config.imageInfo.toLowerCase().replace(/\s/g, ',').split(',');
      // now filter the array to only those that have values
      this.config.imageInfo = this.config.imageInfo.filter(function (n) { return n });
    }

    if (!this.config.transitionImages) {
      this.config.transitionSpeed = '0';
    }

    // Lets make sure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overriden
    if (this.config.backgroundAnimationDuration === '1s') {
      this.config.backgroundAnimationDuration = this.config.slideshowSpeed / 1000 + 's';
    }

    // Chrome versions < 81 do not support EXIF orientation natively. A CSS transformation
    // needs to be applied for the image to display correctly - see http://crbug.com/158753 .
    // this.browserSupportsExifOrientationNatively = CSS.supports('image-orientation: from-image');
  },

  getScripts: function () {
    return [/* 'modules/' + this.name + '/node_modules/exif-js/exif.js', */ 'modules/' + this.name + '/node_modules/lodash/lodash.js', 'moment.js'];
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return ['mmm-amazon-photos.css'];
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    if (sender) {
      Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
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
          this.savedImages = payload.imageSource;
          this.savedIndex = 0;
        } else {
          this.imageSource = payload.imageSource;
          // if image list actually contains images
          // set loaded flag to true and update dom
          if (this.imageSource) {
            this.updateImage(); //Added to show the image at least once, but not change it within this.resume()
            this.resume();
          }
        }
      }
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement('div');
    this.imagesDiv = document.createElement('div');
    this.imagesDiv.className = 'images';
    wrapper.appendChild(this.imagesDiv);

    if (this.config.gradientDirection === 'vertical' || this.config.gradientDirection === 'both') {
      this.createGradientDiv('bottom', this.config.gradient, wrapper);
    }

    if (this.config.gradientDirection === 'horizontal' || this.config.gradientDirection === 'both') {
      this.createGradientDiv('right', this.config.gradient, wrapper);
    }

    if (this.config.showImageInfo) {
      this.imageInfoDiv = this.createImageInfoDiv(wrapper);
    }

    if (this.config.showProgressBar) {
      this.createProgressbarDiv(wrapper, this.config.slideshowSpeed);
    }

    if (this.config.imagePaths.length == 0) {
      // Log.error('mmm-amazon-photos: Missing required parameter imagePaths.');
    } else {
      // create an empty image list
      this.imageSource = null;
      // set beginning image index to 0, as it will auto increment on start
      // this.imageIndex = 0;
      this.updateImageList();
    }

    return wrapper;
  },

  createGradientDiv: function (direction, gradient, wrapper) {
    var div = document.createElement('div');
    div.style.backgroundImage = 'linear-gradient( to ' + direction + ', ' + gradient.join() + ')';
    div.className = 'gradient';
    this.config.focus ?
      div.addEventListener('click', function () {
        document.getElementsByClassName('container')
          .forEach(function (elem) {
            if (!elem.innerHTML.includes('mmm-amazon-photos') && elem.innerHTML !== '') {
              if (elem.style.display === 'none') {
                elem.style.display = 'block'
              } else {
                elem.style.display = 'none'
              }
            }
          })
      })
      : undefined
    wrapper.appendChild(div);
  },

  createDiv: function () {
    var div = document.createElement('div');
    div.style.backgroundSize = this.config.backgroundSize;
    div.style.backgroundPosition = this.config.backgroundPosition;
    div.className = 'image';
    return div;
  },

  createImageInfoDiv: function (wrapper) {
    const div = document.createElement('div');
    div.className = 'info ' + this.config.imageInfoLocation;
    wrapper.appendChild(div);
    return div;
  },

  createProgressbarDiv: function (wrapper, slideshowSpeed) {
    const div = document.createElement('div');
    div.className = 'progress';
    const inner = document.createElement('div');
    inner.className = 'progress-inner';
    inner.style.display = 'none';
    inner.style.animation = `move ${slideshowSpeed}ms linear`;
    div.appendChild(inner);
    wrapper.appendChild(div);
  },

  updateImage: function (backToPreviousImage = false, imageToDisplay = null) {
    // if (!imageToDisplay) {
    //   if (!this.imageSource || !this.imageSource.length) {
    //     return;
    //   }

    //   if (this.imageIndex >= this.imageSource.length) {
    //     this.imageIndex = 0;
    //     // only update the image list if one wasn't sent through notifications
    //     if (!this.savedImages) {
    //       this.updateImageList();
    //       return;
    //     }
    //   }
    // }

    const image = new Image();
    const that = this
    image.onload = function () {
      // check if there are more than 2 elements and remove the first one
      if (that.imagesDiv.childNodes.length > 1) {
        that.imagesDiv.removeChild(that.imagesDiv.childNodes[0]);
      }
      if (that.imagesDiv.childNodes.length > 0) {
        that.imagesDiv.childNodes[0].style.opacity = '0';
      }

      const transitionDiv = document.createElement('div');
      transitionDiv.className = 'transition';
      if (that.config.transitionImages && that.config.transitions.length > 0) {
        let randomNumber = Math.floor(Math.random() * that.config.transitions.length);
        transitionDiv.style.animationDuration = that.config.transitionSpeed;
        transitionDiv.style.transition = `opacity ${that.config.transitionSpeed} ease-in-out`;
        transitionDiv.style.animationName = that.config.transitions[randomNumber];
        transitionDiv.style.animationTimingFunction = that.config.transitionTimingFunction;
      }

      const imageDiv = that.createDiv();
      imageDiv.style.backgroundImage = `url("${image.src}")`;
      // imageDiv.style.transform = 'rotate(0deg)';

      // this.div1.style.backgroundImage = `url("${image.src}")`;
      // this.div1.style.opacity = '1';

      if (that.config.showProgressBar) {
        // Restart css animation
        const oldDiv = document.getElementsByClassName('progress-inner')[0];
        const newDiv = oldDiv.cloneNode(true);
        oldDiv.parentNode.replaceChild(newDiv, oldDiv);
        newDiv.style.display = '';
      }

      // Check to see if we need to animate the background
      if (that.config.backgroundAnimationEnabled && that.config.animations.length) {
        randomNumber = Math.floor(Math.random() * that.config.animations.length);
        const animation = that.config.animations[randomNumber];
        imageDiv.style.animationDuration = that.config.backgroundAnimationDuration;
        imageDiv.style.animationDelay = that.config.transitionSpeed;

        if (animation === 'slide') {
          // check to see if the width of the picture is larger or the height
          var width = image.width;
          var height = image.height;
          var adjustedWidth = (width * window.innerHeight) / height;
          var adjustedHeight = (height * window.innerWidth) / width;

          imageDiv.style.backgroundPosition = '';
          imageDiv.style.animationIterationCount = that.config.backgroundAnimationLoopCount;
          imageDiv.style.backgroundSize = 'cover';

          if (adjustedWidth / window.innerWidth > adjustedHeight / window.innerHeight) {
            // Scrolling horizontally...
            imageDiv.className += ' slideH';
          } else {
            // Scrolling vertically...
            imageDiv.className += ' slideV';
          }
        } else {
          imageDiv.className += ` ${animation}`;
        }
      }

      // EXIF.getData(image, () => {
      //   if (this.config.showImageInfo) {
      //     let dateTime = EXIF.getTag(image, 'DateTimeOriginal');
      //     // attempt to parse the date if possible
      //     if (dateTime !== null) {
      //       try {
      //         dateTime = moment(dateTime, 'YYYY:MM:DD HH:mm:ss');
      //         dateTime = dateTime.format('dddd MMMM D, YYYY HH:mm');
      //       } catch (e) {
      //         console.log('Failed to parse dateTime: ' + dateTime + ' to format YYYY:MM:DD HH:mm:ss');
      //         dateTime = '';
      //       }
      //     }
      //     // TODO: allow for location lookup via openMaps
      //     // let lat = EXIF.getTag(this, "GPSLatitude");
      //     // let lon = EXIF.getTag(this, "GPSLongitude");
      //     // // Only display the location if we have both longitute and lattitude
      //     // if (lat && lon) {
      //     //   // Get small map of location
      //     // }
      //     this.updateImageInfo(decodeURI(image.src), dateTime);
      //   }

      // if (!this.browserSupportsExifOrientationNatively) {
      //   const exifOrientation = EXIF.getTag(image, 'Orientation');
      //   imageDiv.style.transform = this.getImageTransformCss(exifOrientation);
      // }
      // });
      transitionDiv.appendChild(imageDiv);
      that.imagesDiv.appendChild(transitionDiv);
    };
    console.info(`this.imageSource ${this.imageSource}`)
    image.src = encodeURI(this.imageSource);
    // this.imageIndex += 1;

    this.sendNotification('AMAZONPHOTOS_IMAGE_UPDATED', { url: image.src });
    console.info('Updating image, source:' + image.src);
  },

  // getImageTransformCss: function (exifOrientation) {
  //   switch (exifOrientation) {
  //     case 2:
  //       return 'scaleX(-1)';
  //     case 3:
  //       return 'scaleX(-1) scaleY(-1)';
  //     case 4:
  //       return 'scaleY(-1)';
  //     case 5:
  //       return 'scaleX(-1) rotate(90deg)';
  //     case 6:
  //       return 'rotate(90deg)';
  //     case 7:
  //       return 'scaleX(-1) rotate(-90deg)';
  //     case 8:
  //       return 'rotate(-90deg)';
  //     case 1: // Falls through.
  //     default:
  //       return 'rotate(0deg)';
  //   }
  // },

  updateImageInfo: function (imageSrc, imageDate) {
    let imageProps = [];
    this.config.imageInfo.forEach(function (prop, idx) {
      switch (prop) {
        case 'date':
          if (imageDate && imageDate != 'Invalid date') {
            imageProps.push(imageDate);
          }
          break;

        case 'name': // default is name
          // Only display last path component as image name if recurseSubDirectories is not set.
          let imageName = imageSrc.split('/').pop();

          // Otherwise display path relative to the path in configuration.
          if (this.config.recursiveSubDirectories) {
            for (const path of this.config.imagePaths) {
              if (!imageSrc.includes(path)) {
                continue;
              }

              imageName = imageSrc.split(path).pop();
              if (imageName.startsWith('/')) {
                imageName = imageName.substr(1);
              }
              break;
            }
          }
          imageProps.push(imageName);
          break;
        // case 'imagecount':
        //   imageProps.push(`${this.imageIndex} of ${this.imageList.length}`);
        //   break;
        default:
          Log.warn(prop + ' is not a valid value for imageInfo.  Please check your configuration');
      }
    });

    let innerHTML = '<header class="infoDivHeader">Picture Info</header>';
    imageProps.forEach(function (val, idx) {
      innerHTML += val + '<br/>';
    });

    this.imageInfoDiv.innerHTML = innerHTML;
  },

  suspend: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  resume: function () {
    //this.updateImage(); //Removed to prevent image change whenever MMM-Carousel changes slides
    this.suspend();
    var self = this;
    this.timer = setInterval(function () {
      console.info('mmm-amazon-photos updating from resume');
      self.updateImageList();
    }, self.config.slideshowSpeed);
  },

  updateImageList: function () {
    this.suspend();
    console.info('Getting Images');
    // ask helper function to get the image list
    this.sendSocketNotification('AMAZONPHOTOS_REGISTER_CONFIG', this.config);
  },
});
