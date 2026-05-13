declare module 'onvif' {
  interface CamOptions {
    hostname: string;
    port: number;
    username: string;
    password: string;
    autoconnect?: boolean;
  }

  interface ContinuousMoveOptions {
    x?: number;
    y?: number;
    zoom?: number;
    timeout?: number;
    profileToken?: string;
  }

  interface StopOptions {
    profileToken?: string;
    panTilt?: boolean;
    zoom?: boolean;
  }

  class Cam {
    constructor(options: CamOptions, callback: (err?: Error) => void);
    continuousMove(
      options: ContinuousMoveOptions,
      callback: (err?: Error) => void,
    ): void;
    stop(options: StopOptions, callback: (err?: Error) => void): void;
    gotoHomePosition(
      options: { profileToken?: string; speed?: { x: number; y: number } },
      callback: (err?: Error) => void,
    ): void;
    activeSource: { profileToken: string };
  }
}
