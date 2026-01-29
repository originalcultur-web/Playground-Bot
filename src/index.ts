import http from "http";

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
