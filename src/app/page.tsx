export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-4">Matatu Lightning Pay</h1>
      <p className="text-lg text-gray-500 max-w-sm">
        Scan the QR code in the vehicle, or visit <code>/pay/&lt;vehicle-code&gt;</code> to pay a fare.
        Conductors: sign in at <code>/login</code>.
      </p>
    </main>
  )
}
