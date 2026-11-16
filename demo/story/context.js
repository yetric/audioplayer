export function getStoryContext(story, sourceId, passageId) {
  const episodeIndex = story.episodes.findIndex((episode) => episode.id === sourceId);
  const episode = story.episodes[episodeIndex];
  const passageIndex = episode?.passages.findIndex((passage) => passage.id === passageId) ?? -1;
  if (passageIndex < 0) return null;
  return {
    episode,
    passage: episode.passages[passageIndex],
    visiblePassages: episode.passages.slice(0, passageIndex + 1),
    canAsk: episodeIndex > 0 || passageIndex >= 4,
    canAnswer: episodeIndex === 1 && passageIndex >= 3,
  };
}
