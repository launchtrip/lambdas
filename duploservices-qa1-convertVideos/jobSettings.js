export const jobSettings = {
  OutputGroups: [
    {
      CustomName: 'MP4',
      Name: 'File Group',
      Outputs: [
        {
          ContainerSettings: {
            Container: 'MP4',
            Mp4Settings: {},
          },
          VideoDescription: {
            CodecSettings: {
              Codec: 'H_264',
              H264Settings: {
                ParNumerator: 16,
                ParDenominator: 11,
                FramerateDenominator: 1,
                MaxBitrate: 2000000,
                FramerateControl: 'SPECIFIED',
                RateControlMode: 'QVBR',
                FramerateNumerator: 60,
                SceneChangeDetect: 'TRANSITION_DETECTION',
                ParControl: 'SPECIFIED',
              },
            },
          },
          AudioDescriptions: [
            {
              CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                  Bitrate: 96000,
                  CodingMode: 'CODING_MODE_2_0',
                  SampleRate: 48000,
                },
              },
            },
          ],
        },
      ],
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: 's3://<MEDIABUCKET>/assets/VANLIFE/MP4/',
        },
      },
    },
    {
      CustomName: 'Thumbnails',
      Name: 'File Group',
      Outputs: [
        {
          ContainerSettings: {
            Container: 'RAW',
          },
          VideoDescription: {
            CodecSettings: {
              Codec: 'FRAME_CAPTURE',
              FrameCaptureSettings: {
                FramerateNumerator: 60,
                FramerateDenominator: 1,
                MaxCaptures: 1,
                Quality: 100,
              },
            },
          },
        },
      ],
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: 's3://<MEDIABUCKET>/assets/VANLIFE/Thumbnails/',
        },
      },
    },
  ],
  AdAvailOffset: 0,
  Inputs: [
    {
      AudioSelectors: {
        'Audio Selector 1': {
          Offset: 0,
          DefaultSelection: 'DEFAULT',
          ProgramSelection: 1,
        },
      },
      VideoSelector: {
        ColorSpace: 'FOLLOW',
      },
      FilterEnable: 'AUTO',
      PsiControl: 'USE_PSI',
      FilterStrength: 0,
      DeblockFilter: 'DISABLED',
      DenoiseFilter: 'DISABLED',
      TimecodeSource: 'EMBEDDED',
      FileInput: '',
    },
  ],
};
