export type ReverseGeocodeParams = {
  lat: number;
  lng: number;
  locale: string;
};

export type ReverseGeocodeResponse = {
  countryName: string;
  city: string;
  timezone: string;
};
