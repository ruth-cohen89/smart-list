import express from 'express'
import mainRouter from './routes/main.routes'

export const createApp = () => {
    const app = express()

    app.use(express.json())
    app.use('/api/v1', mainRouter)

    return app
}
