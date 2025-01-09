export interface RainSchedule {
  date: string;
  time: string[];
}

export const parseRainSchedule = (htmlContent: string) => {
  console.log(htmlContent);
};
