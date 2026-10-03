export function flatLessons(modules) {
  return (modules || []).flatMap((mod) =>
    (mod.lessons || []).map((lesson) => ({
      ...lesson,
      moduleTitle: mod.title,
    }))
  );
}

export function isModuleOpen(modules, index, progress) {
  const mod = modules?.[index];
  if (!mod || mod.status !== 'ready') return false;
  for (let i = 0; i < index; i += 1) {
    const quiz = modules[i].lessons?.find((lesson) => lesson.kind === 'quiz');
    if (quiz && !progress?.[quiz.id]?.completed) return false;
  }
  return true;
}

export function courseStats(modules, progress) {
  const lessons = flatLessons(modules);
  const done = lessons.filter((lesson) => progress?.[lesson.id]?.completed).length;
  const total = lessons.length;
  return {
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    ready: total > 0 && done === total,
  };
}
