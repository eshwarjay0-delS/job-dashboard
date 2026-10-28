import SharedChat from './shared-chat'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SharedChat key={id} id={id} />
}
