import http from "http";

const port = parseInt(process.env.PORT || "5000", 10);

const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

healthServer.listen(port, "0.0.0.0", () => {
  console.log(`Health check server running on port ${port}`);
  import("./bot.js").catch(console.error);
});
