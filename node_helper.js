/*
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

// call in the required classes
/**
 * @external node_helper
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/node_helper.js
 */
const NodeHelper = require('node_helper')
const Fs = require('fs')
const Path = require('path')
const { default: Axios } = require('axios')
const regex = /(.*)\/.*\/share\/(.*)/gm

// the main module helper create
module.exports = NodeHelper.create({
  // get the next image
  getImage: async function (config) {
    // get next image from random URL
    const imageUrl =
      config.imageUrls[Math.floor(Math.random() * config.imageUrls.length)]
    const matches = regex.exec(imageUrl)
    if (matches?.length === 3) {
      const baseUrl = matches[1]
      const shareId = matches[2]

      const path = Path.resolve(__dirname, 'images', 'photo.jpg')
      const jsonPath = Path.resolve(__dirname, 'images', 'cache.json')

      const cachedNextTokens = Fs.existsSync(jsonPath)
        ? JSON.parse(Fs.readFileSync(jsonPath, 'utf8'))
        : {}

      const res = await Axios.get(
        `${baseUrl}/drive/v1/shares/${shareId}?shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      )
      // prints out album name the photo part of
      console.log(`Get photo from ${res.data.nodeInfo.name}`)
      const intermediateRes = await Axios.get(
        `${baseUrl}/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&tempLink=true&shareId=${shareId}&offset=0&resourceVersion=V2&ContentType=JSON`
      )

      let url = `${baseUrl}/drive/v1/nodes/${intermediateRes.data.data[0].id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=['contentProperties.contentDate ASC']&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      if (
        'kind' in intermediateRes.data.data[0] &&
        intermediateRes.data.data[0].kind === 'FILE'
      ) {
        url = `${baseUrl}/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=['contentProperties.contentDate ASC']&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
      }
      if (Object.prototype.hasOwnProperty.call(cachedNextTokens, shareId)) {
        url = url.concat(`&offset=${cachedNextTokens[shareId]}`)
      }
      const response = await Axios.get(url)
      const amazonPhotosData = response.data
      let id = ''
      if (
        'data' in amazonPhotosData &&
        amazonPhotosData.data.length > 0 &&
        'tempLink' in amazonPhotosData.data[0]
      ) {
        id = amazonPhotosData.data[0].id
        await this.downloadImage(amazonPhotosData.data[0].tempLink, path)

        if (amazonPhotosData.count === cachedNextTokens[shareId] - 1) {
          cachedNextTokens[shareId] = 0
        } else {
          cachedNextTokens[shareId] = cachedNextTokens[shareId] + 1
        }
      } else {
        console.error(
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
      const returnPayload = {
        identifier: config.identifier,
        image: `modules/mmm-amazon-photos/images/photo.jpg?offset=${cachedNextTokens[shareId]}&id=${id}`,
      }
      // send the image list back
      this.sendSocketNotification('AMAZONPHOTOS_FILELIST', returnPayload)
    }
  },

  downloadImage: async function downloadImage(url, path) {
    const writer = Fs.createWriteStream(path)

    const response = await Axios({
      url: `${url}?viewBox=3840%2C2160`,
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
          console.info('Return cached image')
          const returnPayload = {
            identifier: config.identifier,
            image: 'modules/mmm-amazon-photos/images/photo.jpg?cached=true',
          }
          // send the image list back
          this.sendSocketNotification('AMAZONPHOTOS_FILELIST', returnPayload)
          return
        }
      } catch (err) {
        console.info('No previously cached file found', err)
      }

      // Get the image in a non-blocking way since large image or long loading would cause
      // the MagicMirror startup banner to get stuck sometimes.
      setTimeout(async () => {
        await this.getImage(config).catch((err) => console.log(err))
      }, 5000)
    }
  },
})

//------------ end -------------
