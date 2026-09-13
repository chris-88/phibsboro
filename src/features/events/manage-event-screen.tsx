import { RoutePlaceholder } from '@/components/route-placeholder'
import { useRouteParam } from '@/lib/use-route-param'

/** Placeholder. S4.3 builds this screen. */
export default function ManageEventScreen(): React.JSX.Element {
  const id = useRouteParam('id')
  return <RoutePlaceholder story="S4.3" name="Manage event" detail={`id: ${id}`} />
}
