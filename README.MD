# c64js

This is an embryo of a commodore 64 emulator, written from scratch in javascript. A demo of the emulator is available at [mborgbrant.github.io/c64js](http://mborgbrant.github.io/c64js/).

## Roms

In order to run roms, drop them in `.prg`-format on the emulators canvas area. The VIC-II (GPU) chip isn't fully emulated yet, so there is a limited number of ROMS which actually will work.

## Build for production

Install the npm packages:

`> npm install`

Build the distribution:

`> gulp`

## Contributions

Contributions are always welcome! Please read the [contribution guidelines](CONTRIBUTING.MD) first.

## Copyright and license
Code and documentation copyright 2015-2016 Mikael Borgbrant. Code released under [the MIT license](LICENSE.MD).
