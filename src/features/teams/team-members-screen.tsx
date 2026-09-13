import { RoutePlaceholder } from '@/components/route-placeholder'
import { useRouteParam } from '@/lib/use-route-param'

/** Placeholder. S6.4 builds this screen. */
export default function TeamMembersScreen(): React.JSX.Element {
  const teamId = useRouteParam('teamId')
  return <RoutePlaceholder story="S6.4" name="Members" detail={`teamId: ${teamId}`} />
}
