import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
  // Esta página no renderizará nada, solo redirigirá.
  // Se puede mantener un contenido mínimo como fallback si fuera necesario,
  // pero la redirección es la acción principal.
  return null;
}
