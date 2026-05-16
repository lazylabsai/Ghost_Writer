// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { exec as execCb } from "node:child_process"
import { promisify } from "node:util"
import { app } from "electron"
import { v4 as uuidv4 } from "uuid"
import screenshot from "screenshot-desktop"

const isDev = process.env.NODE_ENV === "development" && !app.isPackaged;

const exec = promisify(execCb)

export class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 5

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" = "queue"

  constructor(view: "queue" | "solutions" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    return this.extraScreenshotQueue
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err) {
          // console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
        }
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err) {
          // console.error(
          //   `Error deleting extra screenshot at ${screenshotPath}:`,
          //   err
          // )
        }
      })
    })
    this.extraScreenshotQueue = []
  }

  public async takeScreenshot(
    hideMainWindow?: () => void,
    showMainWindow?: () => void
  ): Promise<string> {
    try {
      if (hideMainWindow) hideMainWindow()

      // Add a small delay only if we are actually hiding windows
      if (hideMainWindow) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      let screenshotPath = ""

      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`)
      } else {
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`)
      }

      // Use native desktopCapturer for maximum speed and smoothness
      await this.captureViaDesktopCapturer(screenshotPath)

      // Manage queue size
      const queue = this.view === "queue" ? this.screenshotQueue : this.extraScreenshotQueue
      queue.push(screenshotPath)
      
      if (queue.length > this.MAX_SCREENSHOTS) {
        const removedPath = queue.shift()
        if (removedPath) {
          try {
            await fs.promises.unlink(removedPath)
          } catch (error) {
            if (isDev) console.error("Error removing old screenshot:", error)
          }
        }
      }

      return screenshotPath
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error.message}`)
    } finally {
      if (showMainWindow) showMainWindow()
    }
  }

  /**
   * Captures the primary screen using Electron's native desktopCapturer.
   * This is much faster and smoother than external process alternatives.
   */
  private async captureViaDesktopCapturer(filepath: string): Promise<void> {
    const { desktopCapturer, screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    // Get sources for the screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })

    const primarySource = sources[0] // Usually the primary monitor
    if (!primarySource) throw new Error("No screen source found for capture")

    const pngBuffer = primarySource.thumbnail.toPNG()
    await fs.promises.writeFile(filepath, pngBuffer)
  }

  public async takeSelectiveScreenshot(
    hideMainWindow?: () => void,
    showMainWindow?: () => void
  ): Promise<string> {
    try {
      if (hideMainWindow) hideMainWindow()

      // Add a small delay only if hiding
      if (hideMainWindow) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      let screenshotPath = ""
      screenshotPath = path.join(this.screenshotDir, `selective-${uuidv4()}.png`)

      try {
        if (process.platform === 'darwin') {
          await exec(`screencapture -i -x "${screenshotPath}"`)
        } else {
          // On Windows/Linux fallback to our fast desktopCapturer full screen capture
          await this.captureViaDesktopCapturer(screenshotPath)
        }
      } catch (e: any) {
        throw new Error("Selection cancelled")
      }

      if (!fs.existsSync(screenshotPath)) {
        throw new Error("Selection cancelled")
      }

      return screenshotPath
    } finally {
      if (showMainWindow) showMainWindow()
    }
  }

  public async getImagePreview(filepath: string): Promise<string> {
    const maxRetries = 20
    const delay = 250 // 5s total wait time

    for (let i = 0; i < maxRetries; i++) {
      try {
        if (fs.existsSync(filepath)) {
          // Double check file size is > 0
          const stats = await fs.promises.stat(filepath)
          if (stats.size > 0) {
            const data = await fs.promises.readFile(filepath)
            return `data:image/png;base64,${data.toString("base64")}`
          }
        }
      } catch (error) {
        // console.log(`[ScreenshotHelper] Retry ${i + 1}/${maxRetries} failed:`, error)
      }
      // Wait for file system
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    throw new Error(`Failed to read screenshot after ${maxRetries} retries (${maxRetries * delay}ms): ${filepath}`)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        )
      }
      return { success: true }
    } catch (error) {
      // console.error("Error deleting file:", error)
      return { success: false, error: error.message }
    }
  }
}
