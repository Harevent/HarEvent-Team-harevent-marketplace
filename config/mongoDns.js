const dns = require("node:dns");

function configureMongoDns(servers) {
  if (!servers || !servers.trim()) return;

  try {
    // The MongoDB driver uses Node's DNS resolver for mongodb+srv URIs.
    dns.setServers(servers.split(",").map((server) => server.trim()));
  } catch {
    throw new Error(
      "MONGODB_DNS_SERVERS must be a comma-separated list of DNS server IP addresses.",
    );
  }
}

module.exports = configureMongoDns;
