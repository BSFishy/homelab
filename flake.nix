{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: flake-utils.lib.eachDefaultSystem (system:
    let
      pkgs = import nixpkgs {
        inherit system;
      };
    in
    {
      devShells = {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.docker
            pkgs.docker-compose
          ];

          # shellHook = ''
          #   DOCKERD_PID=$(pgrep dockerd)
          #   if [ -z "$DOCKERD_PID" ]; then
          #     echo "Starting Docker daemon..."
          #     nohup sudo $(which dockerd) > /tmp/dockerd.log 2>&1 &
          #     sleep 5
          #     DOCKERD_PID=$(pgrep dockerd)
          #     if [ -n "$DOCKERD_PID" ]; then
          #       echo "Docker daemon started successfully with PID $DOCKERD_PID."
          #     else
          #       echo "Failed to start Docker daemon. Check /tmp/dockerd.log for details."
          #     fi
          #   else
          #     echo "Docker daemon is already running with PID $DOCKERD_PID."
          #   fi
          # '';
          #
          # shellExit = ''
          #   DOCKERD_PID=$(pgrep dockerd)
          #   if [ -n "$DOCKERD_PID" ]; then
          #     echo "Stopping Docker daemon with PID $DOCKERD_PID..."
          #     sudo kill -SIGTERM $DOCKERD_PID
          #     echo "Docker daemon stopped."
          #   else
          #     echo "No running Docker daemon found."
          #   fi
          # '';
        };
      };
    });
}
