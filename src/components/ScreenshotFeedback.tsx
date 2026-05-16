import React, { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

export const ScreenshotFeedback: React.FC = () => {
  const [isTaking, setIsTaking] = useState(false)

  useEffect(() => {
    if (!window.electronAPI.onScreenshotTaking) return

    const unsubscribe = window.electronAPI.onScreenshotTaking(() => {
      setIsTaking(true)
      setTimeout(() => setIsTaking(false), 200)
    })

    return () => unsubscribe()
  }, [])

  return (
    <AnimatePresence>
      {isTaking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed inset-0 z-[9999] pointer-events-none bg-white/40"
        />
      )}
    </AnimatePresence>
  )
}

export default ScreenshotFeedback
