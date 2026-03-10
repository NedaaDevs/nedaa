export type OrientationSource =
  | "fop"
  | "rotation_vector"
  | "accelerometer_magnetometer"
  | "cl_location";

export type OrientationData = {
  heading: number;
  accuracy: number;
  source: OrientationSource;
};
