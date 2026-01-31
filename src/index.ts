import http from "http";

const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

if (isRailway) {
  console.log("Running on Railway - skipping health server");
  import("./bot.js").catch(console.error);
} else {
  const healthServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  });

  healthServer.listen(5000, "0.0.0.0", () => {
    console.log("Health check server running on port 5000");
    setTimeout(() => {
      import("./bot.js").catch(console.error);
    }, 100);
  });
}
