import http from "http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Playground Bot is running!");
});

server.listen(5000, "0.0.0.0", () => {
  console.log("Health check server running on port 5000");
  
  import("./bot.js").then(() => {
    console.log("Bot module loaded");
  }).catch((err) => {
    console.error("Failed to load bot:", err);
  });
});
