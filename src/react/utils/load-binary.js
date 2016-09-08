// Native
import path from 'path'

// Packages
import {remote} from 'electron'
import tmp from 'tmp-promise'

// Ours
import showError from './error'

// Load from main process
const fetch = remote.require('node-fetch')
const Sudoer = remote.require('electron-sudo').default
const fs = remote.require('fs-promise')

const getBinaryURL = async () => {
  const url = 'https://api.github.com/repos/zeit/now-binaries/releases/latest'

  let response

  try {
    response = await fetch(url)
  } catch (err) {
    showError('Not able to load latest binary release', err)
    return
  }

  if (!response.ok) {
    showError('Latest binary release could not be loaded')
    return
  }

  try {
    response = await response.json()
  } catch (err) {
    showError('Could not parse response as JSON', err)
    return
  }

  const downloadURL = response.assets[0].browser_download_url

  if (!downloadURL) {
    showError('Latest release doesn\'t contain a binary')
    return
  }

  return downloadURL
}

const downloadBinary = async url => {
  let response

  try {
    response = await fetch(url)
  } catch (err) {
    showError('Not able to download binary', err)
    return
  }

  if (!response.ok) {
    showError('Newest binary could not be downloaded')
    return
  }

  let tempDir

  try {
    tempDir = await tmp.dir()
  } catch (err) {
    showError('Could not create temporary directory', err)
    return
  }

  console.log('Generated temp dir')

  const destination = path.join(tempDir.path, 'now')

  const writeStream = fs.createWriteStream(destination)
  response.body.pipe(writeStream)

  return {
    path: destination,
    cleanup: tempDir.cleanup
  }
}

export default async () => {
  const downloadURL = await getBinaryURL()
  const location = await downloadBinary(downloadURL)

  const sudoer = new Sudoer({
    name: 'Now'
  })

  const destination = '/usr/local/bin/now'
  const mv = await sudoer.spawn('mv', [location.path, destination])

  mv.on('close', () => {
    console.log('Done!')
    location.cleanup()
  })
}