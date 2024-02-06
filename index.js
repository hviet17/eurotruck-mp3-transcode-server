const spawn = require("child_process").spawn
const http = require('http');
const streams = require('./streams.json');
function handleStream(req, res) {
    console.log(`Incoming request for URL '${req.url}' with method '${req.method}'`);
    console.log(`Incoming request headers: ${req.rawHeaders}`, "DEBUG");
    res.writeHead(200, { "Content-Type": "audio/mpeg" });

    const inputStream = streams.find(_ => _.output === req.url).url
    const ffmpegProcess = spawn("ffmpeg", [
        "-nostdin",
        "-loglevel",
        "warning",
        "-re",
        "-i",
        inputStream,
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        "-f",
        "mp3",
        "pipe:1",
    ]);
    ffmpegProcess.stdout.pipe(res);

    console.log(`Spawned FFmpeg process with PID '${ffmpegProcess.pid}'`);

    ffmpegProcess.stderr.on("data", (data) => {
        console.log(`stdout: ${data}`);
    });

    ffmpegProcess.on("data", (error) => {
        console.log(
            `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
        );
    });

    ffmpegProcess.on("error", (error) => {
        console.log(
            `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
        );
    });

    ffmpegProcess.on("close", (code) => {
        console.log(
            `FFmpeg process with PID '${ffmpegProcess.pid}' exited with code ${code}`
        );
        res.end();
    });

    req.on("close", () => {
        console.log(
            `Quitting FFmpeg process with PID '${ffmpegProcess.pid}' …`
        );
        ffmpegProcess.kill();
    });
}

function handleHealthcheck(req, res) {
    console.log("Healthcheck probed");
    res.writeHead(200);
    res.end();
}

function handleNotFound(req, res) {
    console.log(`404 Invalid URL: '${req.url}'`);
    res.writeHead(404);
    res.end();
}

function gracefulShutdown(signal) {
    console.log(`${signal} received. Stopping server …`);
    server.close(() => {
        process.exit(0);
    });
    setTimeout(() => {
        console.log("Timeout reached. Shutting down server now …");
        process.exit(1);
    }, 5000);
}

const outputStreams = streams.map(_ => _.output)
const server = http.createServer(
    { keepAlive: true, keepAliveInitialDelay: 5000 },
    (req, res) => {
        if (outputStreams.includes(req.url)) {
            handleStream(req, res);
            return
        }
        switch (req.url) {
            case "/healthcheck":
            case "/healthcheck/":
                handleHealthcheck(req, res);
                break;
            default:
                handleNotFound(req, res);
                break;
        }
    }
);
const HTTP_PORT= 80
server.listen(HTTP_PORT);
console.log(`Server listening on TCP port ${HTTP_PORT} …`);

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
