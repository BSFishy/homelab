{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells = {
          default = pkgs.mkShell {
            buildInputs = [
              pkgs.consul
              pkgs.nomad
              pkgs.vault
              pkgs.docker
              pkgs.cargo
              pkgs.rustc
              pkgs.rust-analyzer
            ];
          };
        };
      }
    );
}
