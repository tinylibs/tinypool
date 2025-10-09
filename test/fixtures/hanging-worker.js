// Simulates a worker that hangs and never exits
// This reproduces the real-world scenario of orphaned processes

export default function (input) {
  if (input === 'hang') {
    // Create an infinite busy loop that prevents graceful exit
    // Even SIGTERM won't stop this - only SIGKILL will
    while (true) {
      // Busy wait - prevents worker from terminating gracefully
      // This simulates a stuck worker that won't respond to termination signals
    }
  }

  return input
}
