import GameForm from '../../../components/GameForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGamePage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <GameForm mode="edit" gameId={id} />
      </div>
    </div>
  );
}
