import { PlayClient } from "../PlayClient";

/**
 * Network-failure fallback: play one path on the big screen, the room votes
 * A–D by show of hands, and the facilitator clicks the majority choice.
 * Nothing is sent to the tally.
 */
export default function StagePage() {
  return <PlayClient round="stage" stage />;
}
