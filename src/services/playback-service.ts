import TrackPlayer, { Event } from "react-native-track-player";
import { athkarPlayer } from "./athkar-player";

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => athkarPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => athkarPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => athkarPlayer.next());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => athkarPlayer.previous());
  TrackPlayer.addEventListener(Event.RemoteStop, () => athkarPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => athkarPlayer.seekTo(event.position));

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    athkarPlayer.handleTrackChanged(event);
  });

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
    athkarPlayer.handleProgressUpdate(event);
  });

  TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (event) => {
    athkarPlayer.handlePlayWhenReadyChanged(event);
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
    athkarPlayer.handleQueueEnded(event);
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    athkarPlayer.handlePlaybackError(event);
  });
}
