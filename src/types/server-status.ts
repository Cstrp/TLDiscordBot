import { REGIONS } from 'src/enums/regions';

export type ServerStatus = {
  [key in REGIONS]: {
    servers: { name: string; status: string }[];
    timestamp: string;
  };
};
