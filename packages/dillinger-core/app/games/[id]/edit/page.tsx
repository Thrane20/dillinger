import GameForm from '../../../components/GameForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGamePage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <div className="container mx-auto p-8">
      <GameForm mode="edit" gameId={id} />
    </div>
  );
}
