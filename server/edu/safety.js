const RULES = [
  { re: /pornograf|porno\b|nudes?\b|onlyfans|contenido para adultos|sexo explícito|sexual explícit/i, why: 'contenido sexual' },
  { re: /pedofil|pornograf[ií]a infantil|menor(es)? de edad.{0,40}(sexo|desnudo)/i, why: 'contenido sexual con menores' },
  { re: /c[oó]mo (violar|asesinar|matar a|torturar|golpear hasta)/i, why: 'violencia' },
  { re: /(fabricar|sintetizar|cocinar|conseguir|traficar).{0,40}(coca[ií]na|metanfetamina|hero[ií]na|éxtasis|fentanilo|lsd|crack)/i, why: 'drogas' },
  { re: /(hacer|fabricar|armar).{0,30}(bomba|explosivo|arma de fuego)/i, why: 'armas o explosivos' },
  { re: /c[oó]mo (robar|hackear un banco|estafar|clonar una tarjeta|hacer fraude)/i, why: 'una actividad ilegal' },
];

export function screenCoursePrompt(prompt) {
  const text = String(prompt || '');
  const hit = RULES.find((rule) => rule.re.test(text));
  if (!hit) return null;
  return `EduCreator no crea cursos sobre ${hit.why}. Elige un tema para aprender algo legal y seguro.`;
}
