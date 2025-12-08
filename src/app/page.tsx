export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5EF] p-4 text-center">
      <div className="w-full max-w-md space-y-4">
        {/* Ícono */}
        <div className="mx-auto h-14 w-14">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-800/70"
          >
            <path d="M4 20s4-6 8-6 8 6 8 6" />
            <path d="M12 4v10" />
            <path d="M12 8c-2 0-4-2-4-4s2-4 4-4 4 2 4 4-2 4-4 4z" />
          </svg>
        </div>

        {/* Título y Subtítulo */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-800 sm:text-5xl">
            CRApro95
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Sistema de Gestión Agrícola
          </p>
        </div>

        {/* Animación de Carga */}
        <div className="pt-4">
          <p className="animate-pulse text-sm text-gray-500">
            Iniciando sistema…
          </p>
        </div>
      </div>
    </main>
  );
}
