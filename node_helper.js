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
var NodeHelper = require("node_helper")
const Fs = require("fs")
const Path = require("path")
const { default: Axios } = require("axios")

// the main module helper create
module.exports = NodeHelper.create({
  // subclass start method, clears the initial config array
  start: function () {},

  // gathers the image list
  gatherImageList: async function (config) {
    const imageUrl = config.imagePaths[Math.floor(Math.random() * config.imagePaths.length)]
    const shareId = imageUrl.split("share/")[1]
    const path = Path.resolve(__dirname, "images", "code.jpg")
    const jsonPath = Path.resolve(__dirname, "images", "cache.json")
    // create an empty main image list
    let imageList = []

    const cachedNextTokens = Fs.existsSync(jsonPath) ? JSON.parse(Fs.readFileSync(jsonPath, "utf8")) : {}

    const res = await Axios.get(
      `https://www.amazon.de/drive/v1/shares/${shareId}?shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
    )
    console.log(`Get picture from ${res.data.nodeInfo.name}`)
    const intermediateRes = await Axios.get(
      `https://www.amazon.de/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&tempLink=true&shareId=${shareId}&offset=0&resourceVersion=V2&ContentType=JSON`
    )

    let url = `https://www.amazon.de/drive/v1/nodes/${intermediateRes.data.data[0].id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=%5B%27contentProperties.contentDate+ASC%27%5D&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
    if ("kind" in intermediateRes.data.data[0] && intermediateRes.data.data[0].kind === "FILE") {
      url = `https://www.amazon.de/drive/v1/nodes/${res.data.nodeInfo.id}/children?asset=ALL&limit=1&searchOnFamily=false&sort=%5B%27contentProperties.contentDate+ASC%27%5D&tempLink=true&shareId=${shareId}&resourceVersion=V2&ContentType=JSON`
    }
    if (Object.prototype.hasOwnProperty.call(cachedNextTokens, shareId)) {
      url = url.concat(`&offset=${cachedNextTokens[shareId]}`)
    }
    const response = await Axios.get(url)
    const amazonPhotosData = response.data
    if ("data" in amazonPhotosData && amazonPhotosData.data.length > 0 && "tempLink" in amazonPhotosData.data[0]) {
      await this.downloadImage(amazonPhotosData.data[0].tempLink, path)

      if (amazonPhotosData.count === cachedNextTokens[shareId] - 1) {
        cachedNextTokens[shareId] = 0
      } else {
        cachedNextTokens[shareId] = cachedNextTokens[shareId] + 1
      }
    } else {
      console.log(`Could not get image from url: ${url} with response ${JSON.stringify(amazonPhotosData, null, 2)}`)
      cachedNextTokens[shareId] = 0
    }

    if (isNaN(cachedNextTokens[shareId])) {
      cachedNextTokens[shareId] = 1
    }
    Fs.writeFileSync(jsonPath, JSON.stringify(cachedNextTokens, null, 2))

    imageList.push({ path: path })
    // imageList.push({ path: response.data.data[0].tempLink });
    // console.log(await Axios.get(response.data.data[0].tempLink))
    // console.log(await this.downloadImage(response.data.data[0].tempLink));
    // imageList = config.randomizeImageOrder
    // ? this.shuffleArray(imageList)
    // : this.sortImageList(imageList, config.sortImagesBy, config.sortImagesDescending);

    // build the return payload
    const returnPayload = {
      identifier: config.identifier,
      imageList: imageList.map((item) => `modules/mmm-amazon-photos/images/code.jpg?offset=${cachedNextTokens[shareId]}`), // map the array to only extract the paths
    }
    // send the image list back
    this.sendSocketNotification("AMAZONPHOTOS_FILELIST", returnPayload)
  },

  downloadImage: async function downloadImage(url, path) {
    const writer = Fs.createWriteStream(path)

    const response = await Axios({
      url: `${url}?viewBox=3840%2C2160`,
      method: "GET",
      responseType: "stream",
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve)
      writer.on("error", reject)
    })
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    // console.log(notification);
    if (notification === "AMAZONPHOTOS_REGISTER_CONFIG") {
      const config = payload

      try {
        const stats = Fs.statSync(Path.resolve(__dirname, "images", "code.jpg"))
        console.log(
          `Now: ${Date.now()}, mtime: ${new Date(stats.mtime).getTime()}, slideshow speed: ${
            config.slideshowSpeed
          }, comparison: ${Date.now() - new Date(stats.mtime).getTime() < config.slideshowSpeed}`
        )
        if (Date.now() - new Date(stats.mtime).getTime() < config.slideshowSpeed) {
          // if image is not older than refresh interval. Leave it alone
          // return;
          console.info("Return cached image")
          const returnPayload = {
            identifier: config.identifier,
            imageList: [`modules/mmm-amazon-photos/images/code.jpg?cached=true`], // map the array to only extract the paths
          }
          // send the image list back
          this.sendSocketNotification("AMAZONPHOTOS_FILELIST", returnPayload)
          return
        }
      } catch (err) {
        console.error(err)
      }

      // Get the image list in a non-blocking way since large # of images would cause
      // the MagicMirror startup banner to get stuck sometimes.
      setTimeout(async () => {
        await this.gatherImageList(config).catch((err) => console.log(err))
      }, 5000)
    }
  },
})

//------------ end -------------
