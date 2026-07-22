{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    gnumake
    glib
    gettext
    nodejs
  ];
}
