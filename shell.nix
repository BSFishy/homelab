let
pkgs = import <nixpkgs> {};
in
pkgs.mkShell {
    packages = [
    pkgs.docker
    pkgs.docker-compose
    pkgs.cargo
    pkgs.rust-analyzer
    ];
  }
