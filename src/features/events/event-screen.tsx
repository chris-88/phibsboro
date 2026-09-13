import { RoutePlaceholder } from '@/components/route-placeholder'
import { useRouteParam } from '@/lib/use-route-param'

/** Placeholder. S3.3 builds this screen. */
export default function EventScreen(): React.JSX.Element {
  const id = useRouteParam('id')
  return <RoutePlaceholder story="S3.3" name="Event" detail={`id: ${id}`} />
}
