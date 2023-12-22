/* eslint-disable no-unused-vars */
/* global Module */

/* node_helper.js
 *
 * Magic Mirror
 * Module: mmm-amazon-photos
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module mmm-amazon-photos by Stephan Huber and inspired by MMM-BACKGROUNDSLIDESHOW
 * MIT Licensed.
 */

// call in the required classes
const NodeHelper = require('node_helper')
const Fs = require('fs')
const Path = require('path')
const { default: Axios } = require('axios')

// the main module helper create
module.exports = NodeHelper.create({
  // subclass start method, clears the initial config array
  start: function () {},

  // gathers the image list
  gatherImageList: async function (config) {
    const imageUrl = new URL(
      config.imageUrls[Math.floor(Math.random() * config.imageUrls.length)]
    )
    const origin = imageUrl.origin
    const shareId = imageUrl.pathname.split('share/')[1]
    const path = Path.resolve(__dirname, 'images', 'photo.jpg')
    const jsonPath = Path.resolve(__dirname, 'images', 'cache.json')
    let returnPayload

    try {
      // create an empty main image list
      const cachedNextTokens = Fs.existsSync(jsonPath)
        ? JSON.parse(Fs.readFileSync(jsonPath, 'utf8'))
        : {}

      const res = await Axios.get(
        `${origin}/drive/v1/shares/${shareId}?shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      )
      console.log(`Get picture from ${res.data.nodeInfo.name}`)
      const intermediateRes = await Axios.get(
        `${origin}/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&tempLink=true&shareId=${shareId}&offset=0&resourceVersion=V2&ContentType=JSON`
      )

      let url = `${origin}/drive/v1/nodes/${intermediateRes.data.data[0].id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=%5B%27contentProperties.contentDate+ASC%27%5D&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      if (
        'kind' in intermediateRes.data.data[0] &&
        intermediateRes.data.data[0].kind === 'FILE'
      ) {
        url = `${origin}/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=%5B%27contentProperties.contentDate+ASC%27%5D&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      }
      if (Object.prototype.hasOwnProperty.call(cachedNextTokens, shareId)) {
        url = url.concat(`&offset=${cachedNextTokens[shareId]}`)
      }
      const response = await Axios.get(url)
      const amazonPhotosData = response.data
      if (
        'data' in amazonPhotosData &&
        amazonPhotosData.data.length > 0 &&
        'tempLink' in amazonPhotosData.data[0]
      ) {
        await this.downloadImage(amazonPhotosData.data[0].tempLink, path)

        if (amazonPhotosData.count === cachedNextTokens[shareId] - 1) {
          cachedNextTokens[shareId] = 0
        } else {
          cachedNextTokens[shareId] = cachedNextTokens[shareId] + 1
        }
      } else {
        console.log(
          `Could not get image from url: ${url} with response ${JSON.stringify(
            amazonPhotosData,
            null,
            2
          )}`
        )
        cachedNextTokens[shareId] = 0
      }

      if (isNaN(cachedNextTokens[shareId])) {
        cachedNextTokens[shareId] = 1
      }
      Fs.writeFileSync(jsonPath, JSON.stringify(cachedNextTokens, null, 2))

      // build the return payload
      returnPayload = {
        identifier: config.identifier,
        imageSource: `modules/mmm-amazon-photos/images/photo.jpg?shareId=${shareId}&offset=${cachedNextTokens[shareId]}`,
      }
    } catch (err) {
      console.error(err)
      // in case of an error, return the already downloaded image and try again in the next iteration
      returnPayload = {
        identifier: config.identifier,
        imageSource: 'modules/mmm-amazon-photos/images/photo.jpg',
      }
    }
    // send the image list back
    this.sendSocketNotification('AMAZONPHOTOS_FILELIST', returnPayload)
    return
  },

  downloadImage: async function downloadImage(url, path) {
    const writer = Fs.createWriteStream(path)

    const response = await Axios({
      url: `${url}?download=true`,
      method: 'GET',
      responseType: 'stream',
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    if (notification === 'AMAZONPHOTOS_REGISTER_CONFIG') {
      const config = payload

      try {
        const stats = Fs.statSync(
          Path.resolve(__dirname, 'images', 'photo.jpg')
        )
        console.log(
          `Now: ${Date.now()}, mtime: ${new Date(
            stats.mtime
          ).getTime()}, slideshow speed: ${
            config.slideshowSpeed
          }, comparison: ${
            Date.now() - new Date(stats.mtime).getTime() < config.slideshowSpeed
          }`
        )
        if (
          Date.now() - new Date(stats.mtime).getTime() <
          config.slideshowSpeed
        ) {
          // if image is not older than refresh interval. Leave it alone
          // return;
          console.info('Return cached image')
          const returnPayload = {
            identifier: config.identifier,
            imageSource: `modules/mmm-amazon-photos/images/photo.jpg?cached=true`,
          }
          // send the image list back
          this.sendSocketNotification('AMAZONPHOTOS_FILELIST', returnPayload)
          return
        }
      } catch (err) {
        console.error(err)
      }

      // prevent black screen when image exists locally
      // TODO: avoid code duplication
      const returnPayload = {
        identifier: config.identifier,
        imageSource: `modules/mmm-amazon-photos/images/photo.jpg?cached=true`,
      }
      // send the image list back
      this.sendSocketNotification('AMAZONPHOTOS_FILELIST', returnPayload)

      // Get the image list in a non-blocking way since large # of images would cause
      // the MagicMirror startup banner to get stuck sometimes.
      setTimeout(async () => {
        await this.gatherImageList(config).catch((err) => console.log(err))
      }, 5000)
    }
  },
})

//------------ end -------------
